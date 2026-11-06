export function ServiceTimelineStart() {
  return (
    <>
      <style>
        {`
          @keyframes api-service-flow {
            0% {
              transform: translateY(-65%);
              opacity: 0;
            }
            20% {
              opacity: 1;
            }
            80% {
              opacity: 1;
            }
            100% {
              transform: translateY(65%);
              opacity: 0;
            }
          }
        `}
      </style>
      <div
        aria-hidden
        className="absolute -left-12 top-3 w-8 pointer-events-none"
        style={{ height: 'calc(100% + 4rem)' }}
      >
        <div className="absolute left-3 top-3 bottom-0 w-px -translate-x-1/2 bg-border/60" />
        <div
          className="absolute left-3 top-3 bottom-0 w-[3px] -translate-x-1/2 rounded-full animate-[api-service-flow_1.8s_linear_infinite]"
          style={{
            background:
              'linear-gradient(180deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.2) 20%, rgba(59,130,246,0.95) 50%, rgba(59,130,246,0.2) 80%, rgba(59,130,246,0) 100%)',
          }}
        />
        <div className="absolute left-0 top-0 h-6 w-6 rounded-full border-2 border-primary/20 animate-ping" />
        <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-primary/90 shadow-[0_0_16px_rgba(59,130,246,0.35)] animate-ping" />
      </div>
    </>
  );
}

export function ServiceTimelineEnd() {
  return (
    <div aria-hidden className="absolute -left-12 top-3 h-6 w-8 pointer-events-none">
      <div className="absolute left-0 top-0 h-6 w-6 rounded-full border-2 border-primary/20 animate-ping" />
      <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-primary/90 shadow-[0_0_16px_rgba(59,130,246,0.35)] animate-ping" />
    </div>
  );
}
