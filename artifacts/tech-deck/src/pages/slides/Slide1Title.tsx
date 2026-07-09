export default function Slide1Title() {
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
      {/* Inner border */}
      <div
        style={{
          position: "absolute",
          top: "5vh",
          left: "5vw",
          right: "5vw",
          bottom: "5vh",
          border: "0.5px solid rgba(255,255,255,0.1)",
        }}
      />

      <div
        style={{
          padding: "7vh 7vw",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* Top metadata row */}
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
              Drawing No.
            </div>
            <div style={{ fontSize: "1vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
              ARCH-DCK-001
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
              Date
            </div>
            <div style={{ fontSize: "1vw", fontFamily: "'Courier New', monospace" }}>2026-07-09</div>
          </div>
        </div>

        {/* Hero title block */}
        <div>
          <div
            style={{
              fontSize: "0.8vw",
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              opacity: 0.5,
              marginBottom: "1.5vh",
              fontFamily: "'Courier New', monospace",
            }}
          >
            Project Title
          </div>
          <div
            style={{
              fontSize: "7vw",
              fontWeight: 300,
              lineHeight: 0.88,
              letterSpacing: "0.04em",
              textWrap: "balance",
            }}
          >
            PHOTOCLUB
          </div>
          <div
            style={{
              fontSize: "7vw",
              fontWeight: 300,
              lineHeight: 0.88,
              letterSpacing: "0.04em",
            }}
          >
            REVIEWCLUB
          </div>
          <div
            style={{
              width: "8vw",
              height: "1px",
              background: "rgba(255,255,255,0.4)",
              marginTop: "2.5vh",
            }}
          />
          <p
            style={{
              fontSize: "1.3vw",
              opacity: 0.65,
              marginTop: "1.5vh",
              maxWidth: "44vw",
              lineHeight: 1.6,
              fontWeight: 300,
              textWrap: "pretty",
            }}
          >
            A contract-first fullstack monorepo — pnpm workspaces, TypeScript 5.9,
            React + Express + PostgreSQL, deployed on Replit autoscale.
          </p>
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
              Prepared By
            </div>
            <div style={{ fontSize: "0.95vw", fontFamily: "'Courier New', monospace" }}>
              Engineering Dept.
            </div>
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
              Classification
            </div>
            <div style={{ fontSize: "0.95vw", fontFamily: "'Courier New', monospace" }}>
              TECHNICAL
            </div>
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
              Scale
            </div>
            <div style={{ fontSize: "0.95vw", fontFamily: "'Courier New', monospace" }}>1:1</div>
          </div>
        </div>
      </div>
    </div>
  );
}
