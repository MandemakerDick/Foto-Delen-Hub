export default function Slide5Deployment() {
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

      {/* FINAL stamp */}
      <div
        style={{
          position: "absolute",
          top: "8vh",
          right: "8vw",
          border: "0.3vw solid #EF4444",
          padding: "0.8vh 1.2vw",
          color: "#EF4444",
          fontSize: "1.8vw",
          fontWeight: 700,
          transform: "rotate(12deg)",
          opacity: 0.75,
          letterSpacing: "0.2vw",
          fontFamily: "'Courier New', monospace",
        }}
      >
        DEPLOYED
      </div>

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
              Section 05
            </div>
            <div style={{ fontSize: "1vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
              DEPLOYMENT TOPOLOGY
            </div>
          </div>
        </div>

        {/* Content */}
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
            DEPLOYMENT
          </h2>

          {/* Three artifact boxes */}
          <div style={{ display: "flex", gap: "2vw", marginBottom: "2.5vh" }}>
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "1.8vh 1.2vw",
                background: "rgba(186,230,253,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: "0.65vw",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#BAE6FD",
                  fontFamily: "'Courier New', monospace",
                  marginBottom: "0.8vh",
                }}
              >
                &gt; ARTIFACT 1
              </div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700 }}>API Server</div>
              <div style={{ fontSize: "1vw", opacity: 0.65, marginTop: "0.5vh" }}>
                Express 5 · /api path prefix · stateless
              </div>
            </div>
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "1.8vh 1.2vw",
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
                  marginBottom: "0.8vh",
                }}
              >
                &gt; ARTIFACT 2
              </div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700 }}>PhotoClub</div>
              <div style={{ fontSize: "1vw", opacity: 0.65, marginTop: "0.5vh" }}>
                Vite SPA · / root path · Clerk auth
              </div>
            </div>
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "1.8vh 1.2vw",
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
                  marginBottom: "0.8vh",
                }}
              >
                &gt; ARTIFACT 3
              </div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700 }}>PhotoReviewHub</div>
              <div style={{ fontSize: "1vw", opacity: 0.65, marginTop: "0.5vh" }}>
                Vite SPA · /review prefix · admin panel
              </div>
            </div>
          </div>

          {/* Bottom two info panels */}
          <div style={{ display: "flex", gap: "2vw" }}>
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.25)",
                padding: "1.5vh 1.2vw",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: "0.65vw",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#BAE6FD",
                  fontFamily: "'Courier New', monospace",
                  marginBottom: "0.6vh",
                }}
              >
                &gt; TARGET PLATFORM
              </div>
              <div style={{ fontSize: "1.15vw", fontFamily: "'Courier New', monospace" }}>
                Replit Autoscale (Cloud Run)
              </div>
              <div style={{ fontSize: "1vw", opacity: 0.6, marginTop: "0.3vh" }}>
                Scales to zero · shared proxy routes by path prefix
              </div>
            </div>
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.25)",
                padding: "1.5vh 1.2vw",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: "0.65vw",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#BAE6FD",
                  fontFamily: "'Courier New', monospace",
                  marginBottom: "0.6vh",
                }}
              >
                &gt; DATABASE
              </div>
              <div style={{ fontSize: "1.15vw", fontFamily: "'Courier New', monospace" }}>
                PostgreSQL — colocated
              </div>
              <div style={{ fontSize: "1vw", opacity: 0.6, marginTop: "0.3vh" }}>
                Same region · shared by all 3 artifacts via DATABASE_URL
              </div>
            </div>
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.25)",
                padding: "1.5vh 1.2vw",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: "0.65vw",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#BAE6FD",
                  fontFamily: "'Courier New', monospace",
                  marginBottom: "0.6vh",
                }}
              >
                &gt; BUILD
              </div>
              <div style={{ fontSize: "1.15vw", fontFamily: "'Courier New', monospace" }}>
                pnpm --filter per artifact
              </div>
              <div style={{ fontSize: "1vw", opacity: 0.6, marginTop: "0.3vh" }}>
                esbuild CJS bundle · ~2 min end-to-end
              </div>
            </div>
          </div>
        </div>

        {/* Footer title block */}
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
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>FINAL</div>
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
              Authorization
            </div>
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>GRANTED</div>
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
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>05</div>
          </div>
        </div>
      </div>
    </div>
  );
}
