use super::error::{Result, RuntimeIpcError};
use super::message::Message;
use bytes::BytesMut;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

const READ_BUFFER_SIZE: usize = 64 * 1024;

pub struct MessageTransport<R, W> {
    reader: R,
    writer: W,
    read_buffer: BytesMut,
}

impl<R, W> MessageTransport<R, W>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    pub fn new(reader: R, writer: W) -> Self {
        Self {
            reader,
            writer,
            read_buffer: BytesMut::with_capacity(READ_BUFFER_SIZE),
        }
    }

    pub async fn send(&mut self, message: &Message) -> Result<()> {
        let bytes = message.encode()?;
        self.writer
            .write_all(&bytes)
            .await
            .map_err(|error| RuntimeIpcError::SendFailed(error.to_string()))?;
        self.writer
            .flush()
            .await
            .map_err(|error| RuntimeIpcError::SendFailed(error.to_string()))?;
        Ok(())
    }

    pub async fn recv(&mut self) -> Result<Message> {
        loop {
            if let Some((message, consumed)) = Message::try_decode(&self.read_buffer)? {
                let _ = self.read_buffer.split_to(consumed);
                return Ok(message);
            }

            let mut temp = [0u8; READ_BUFFER_SIZE];
            let bytes_read = self
                .reader
                .read(&mut temp)
                .await
                .map_err(|error| RuntimeIpcError::ReceiveFailed(error.to_string()))?;

            if bytes_read == 0 {
                return Err(RuntimeIpcError::ConnectionClosed);
            }

            self.read_buffer.extend_from_slice(&temp[..bytes_read]);
        }
    }
}
