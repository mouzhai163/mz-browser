use super::error::{ErrorCode, Result, RuntimeIpcError};
use super::topics::Topic;
use bytes::{Buf, BufMut, Bytes, BytesMut};
use serde::{Serialize, de::DeserializeOwned};
use std::sync::atomic::{AtomicU32, Ordering};

const MAGIC: [u8; 4] = [0x53, 0x49, 0x4D, 0x00];
pub const PROTOCOL_VERSION: u8 = 0x01;
const HEADER_SIZE: usize = 9;
const MIN_PAYLOAD_SIZE: usize = 15;

static MESSAGE_ID_COUNTER: AtomicU32 = AtomicU32::new(1);

fn next_message_id() -> u32 {
    MESSAGE_ID_COUNTER.fetch_add(1, Ordering::SeqCst)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MessageType {
    Request = 1,
    Response = 2,
    Event = 3,
}

impl TryFrom<u8> for MessageType {
    type Error = RuntimeIpcError;

    fn try_from(value: u8) -> Result<Self> {
        match value {
            1 => Ok(Self::Request),
            2 => Ok(Self::Response),
            3 => Ok(Self::Event),
            other => Err(RuntimeIpcError::InvalidMessage(format!(
                "unknown message type: {}",
                other
            ))),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Message {
    pub msg_id: u32,
    pub msg_type: MessageType,
    pub topic: Topic,
    pub error_code: i32,
    pub data: Vec<u8>,
}

impl Message {
    pub fn request(topic: Topic, data: Vec<u8>) -> Self {
        Self {
            msg_id: next_message_id(),
            msg_type: MessageType::Request,
            topic,
            error_code: 0,
            data,
        }
    }

    pub fn request_payload<T: Serialize>(topic: Topic, payload: &T) -> Result<Self> {
        Ok(Self::request(topic, encode_payload(payload)?))
    }

    pub fn event(topic: Topic, data: Vec<u8>) -> Self {
        Self {
            msg_id: next_message_id(),
            msg_type: MessageType::Event,
            topic,
            error_code: 0,
            data,
        }
    }

    pub fn response(request_id: u32, topic: Topic, error_code: ErrorCode, data: Vec<u8>) -> Self {
        Self {
            msg_id: request_id,
            msg_type: MessageType::Response,
            topic,
            error_code: error_code.as_i32(),
            data,
        }
    }

    pub fn payload<T: DeserializeOwned>(&self) -> Result<T> {
        decode_payload(&self.data)
    }

    pub fn encode(&self) -> Result<Bytes> {
        let payload_len = MIN_PAYLOAD_SIZE + self.data.len();
        let mut payload = BytesMut::with_capacity(payload_len);

        payload.put_u32_le(self.msg_id);
        payload.put_u8(self.msg_type as u8);
        payload.put_u16_le(u16::from(self.topic));
        payload.put_i32_le(self.error_code);
        payload.put_u32_le(self.data.len() as u32);
        payload.put_slice(&self.data);

        let mut frame = BytesMut::with_capacity(HEADER_SIZE + payload.len());
        frame.put_slice(&MAGIC);
        frame.put_u8(PROTOCOL_VERSION);
        frame.put_u32_le(payload.len() as u32);
        frame.put_slice(&payload);

        Ok(frame.freeze())
    }

    pub fn decode(data: &[u8]) -> Result<Self> {
        if data.len() < HEADER_SIZE {
            return Err(RuntimeIpcError::Decode("frame shorter than header".into()));
        }

        let mut buffer = data;

        let mut magic = [0u8; 4];
        magic.copy_from_slice(&buffer[..4]);
        buffer.advance(4);
        if magic != MAGIC {
            return Err(RuntimeIpcError::Decode("invalid magic number".into()));
        }

        let version = buffer.get_u8();
        if version != PROTOCOL_VERSION {
            return Err(RuntimeIpcError::Decode(format!(
                "unsupported protocol version: {}",
                version
            )));
        }

        let payload_len = buffer.get_u32_le() as usize;
        if buffer.len() < payload_len {
            return Err(RuntimeIpcError::Decode("incomplete payload".into()));
        }
        if payload_len < MIN_PAYLOAD_SIZE {
            return Err(RuntimeIpcError::Decode("payload too short".into()));
        }

        let msg_id = buffer.get_u32_le();
        let msg_type = MessageType::try_from(buffer.get_u8())?;
        let topic = Topic::from(buffer.get_u16_le());
        let error_code = buffer.get_i32_le();
        let data_len = buffer.get_u32_le() as usize;
        if buffer.len() < data_len {
            return Err(RuntimeIpcError::Decode("data length mismatch".into()));
        }

        let mut msg_data = vec![0u8; data_len];
        msg_data.copy_from_slice(&buffer[..data_len]);

        Ok(Self {
            msg_id,
            msg_type,
            topic,
            error_code,
            data: msg_data,
        })
    }

    pub fn try_decode(data: &[u8]) -> Result<Option<(Self, usize)>> {
        if data.len() < HEADER_SIZE {
            return Ok(None);
        }

        if &data[..4] != MAGIC.as_slice() {
            return Err(RuntimeIpcError::Decode("invalid magic number".into()));
        }

        let payload_len = u32::from_le_bytes([data[5], data[6], data[7], data[8]]) as usize;
        let total_len = HEADER_SIZE + payload_len;
        if data.len() < total_len {
            return Ok(None);
        }

        Ok(Some((Self::decode(&data[..total_len])?, total_len)))
    }
}

pub fn encode_payload<T: Serialize>(payload: &T) -> Result<Vec<u8>> {
    rmp_serde::to_vec_named(payload)
        .map_err(|error| RuntimeIpcError::Serialization(error.to_string()))
}

pub fn decode_payload<T: DeserializeOwned>(data: &[u8]) -> Result<T> {
    rmp_serde::from_slice(data).map_err(|error| RuntimeIpcError::Decode(error.to_string()))
}
