export default function Slide2Stack() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#1B3A5C",
        fontFamily: "'Space Grotesk', sans-serif",
        position: "relative",
        color: "#FFFFFF",
      }}
    >
      {/* Fine grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "2vw 2vh",
        }}
      />
      {/* Coarse grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "10vw 10vh",
        }}
      />
      {/* Outer border */}
      <div
        style={{
          position: "absolute",
          top: "3vh",
          left: "3vw",
          right: "3vw",
          bottom: "3vh",
          border: "1px solid rgba(255,255,255,0.2)",
        }}
      />

      <div
        style={{
          padding: "6vh 7vw",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div
              style={{
                fontSize: "0.7vw",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                opacity: 0.5,
                fontFamily: "'Courier New', monospace",
              }}
            >
              Section 02
            </div>
            <div style={{ fontSize: "1vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
              TECHNOLOGY STACK
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "0.7vw",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                opacity: 0.5,
                fontFamily: "'Courier New', monospace",
              }}
            >
              Ref No.
            </div>
            <div style={{ fontSize: "1vw", fontFamily: "'Courier New', monospace" }}>SPEC-02A</div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ marginTop: "-2vh" }}>
          <h2
            style={{
              fontSize: "4vw",
              fontWeight: 300,
              margin: 0,
              letterSpacing: "0.05em",
              marginBottom: "3vh",
            }}
          >
            STACK
          </h2>

          {/* Two-column specs grid */}
          <div style={{ display: "flex", gap: "4vw" }}>
            {/* Left column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
              {/* Runtime */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "1.8vh 1.5vw",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65vw",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "#BAE6FD",
                    fontFamily: "'Courier New', monospace",
                    marginBottom: "1vh",
                  }}
                >
                  &gt; RUNTIME
                </div>
                <div style={{ fontSize: "1.4vw", fontWeight: 700, letterSpacing: "0.02em" }}>
                  Node.js 24
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginTop: "0.5vh",
                    gap: "0.5vw",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      borderBottom: "1px dotted rgba(255,255,255,0.25)",
                    }}
                  />
                  <span style={{ fontSize: "1.1vw", opacity: 0.75, fontFamily: "'Courier New', monospace" }}>
                    TypeScript 5.9
                  </span>
                </div>
              </div>

              {/* Frontend */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "1.8vh 1.5vw",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65vw",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "#BAE6FD",
                    fontFamily: "'Courier New', monospace",
                    marginBottom: "1vh",
                  }}
                >
                  &gt; FRONTEND
                </div>
                <div style={{ fontSize: "1.4vw", fontWeight: 700 }}>React + Vite</div>
                <div style={{ fontSize: "1.05vw", opacity: 0.7, marginTop: "0.5vh" }}>
                  Tailwind CSS v4 · Wouter · TanStack Query · Framer Motion
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
              {/* Backend */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "1.8vh 1.5vw",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65vw",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "#BAE6FD",
                    fontFamily: "'Courier New', monospace",
                    marginBottom: "1vh",
                  }}
                >
                  &gt; BACKEND
                </div>
                <div style={{ fontSize: "1.4vw", fontWeight: 700 }}>Express 5</div>
                <div style={{ fontSize: "1.05vw", opacity: 0.7, marginTop: "0.5vh" }}>
                  Drizzle ORM · PostgreSQL · Zod validation
                </div>
              </div>

              {/* Auth + Build */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "1.8vh 1.5vw",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65vw",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "#BAE6FD",
                    fontFamily: "'Courier New', monospace",
                    marginBottom: "1vh",
                  }}
                >
                  &gt; AUTH + BUILD
                </div>
                <div style={{ fontSize: "1.4vw", fontWeight: 700 }}>Clerk (proxy mode)</div>
                <div style={{ fontSize: "1.05vw", opacity: 0.7, marginTop: "0.5vh" }}>
                  esbuild CJS bundle · Orval codegen · pnpm workspaces
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "0.5px solid rgba(255,255,255,0.2)",
            paddingTop: "1.5vh",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.6vw",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                opacity: 0.4,
                fontFamily: "'Courier New', monospace",
              }}
            >
              Status
            </div>
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>VERIFIED</div>
          </div>
          <div>
            <div
              style={{
                fontSize: "0.6vw",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                opacity: 0.4,
                fontFamily: "'Courier New', monospace",
              }}
            >
              Revision
            </div>
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>A.1</div>
          </div>
          <div>
            <div
              style={{
                fontSize: "0.6vw",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                opacity: 0.4,
                fontFamily: "'Courier New', monospace",
              }}
            >
              Page
            </div>
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>02</div>
          </div>
        </div>
      </div>
    </div>
  );
}
