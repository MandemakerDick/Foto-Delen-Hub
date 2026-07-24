export default function Slide3ApiDesign() {
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
              Section 03
            </div>
            <div style={{ fontSize: "1vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
              CONTRACT-FIRST DESIGN
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
            <div style={{ fontSize: "1vw", fontFamily: "'Courier New', monospace" }}>API-03B</div>
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
            API DESIGN
          </h2>

          {/* Pipeline flow — three boxes with arrows */}
          <div style={{ display: "flex", alignItems: "stretch", gap: "0", marginBottom: "3vh" }}>
            {/* Step 1 */}
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "2vh 1.5vw",
                background: "rgba(186,230,253,0.08)",
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
                &gt; SOURCE OF TRUTH
              </div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700 }}>openapi.yaml</div>
              <div style={{ fontSize: "1vw", opacity: 0.65, marginTop: "0.6vh" }}>
                lib/api-spec/ — defines all endpoints, request + response shapes
              </div>
            </div>

            {/* Arrow */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 0.8vw",
                color: "#BAE6FD",
                fontSize: "1.5vw",
                opacity: 0.7,
              }}
            >
              →
            </div>

            {/* Step 2 */}
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "2vh 1.5vw",
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
                &gt; CODEGEN (ORVAL)
              </div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700 }}>Two outputs</div>
              <div style={{ fontSize: "1vw", opacity: 0.65, marginTop: "0.6vh" }}>
                React Query hooks (client) + Zod schemas (server)
              </div>
            </div>

            {/* Arrow */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 0.8vw",
                color: "#BAE6FD",
                fontSize: "1.5vw",
                opacity: 0.7,
              }}
            >
              →
            </div>

            {/* Step 3 */}
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "2vh 1.5vw",
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
              <div style={{ fontSize: "1.5vw", fontWeight: 700 }}>Validated I/O</div>
              <div style={{ fontSize: "1vw", opacity: 0.65, marginTop: "0.6vh" }}>
                Server validates every req/res — never hand-write types Orval generates
              </div>
            </div>
          </div>

          {/* Routing note */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.25)",
              padding: "1.8vh 1.5vw",
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              gap: "3vw",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.65vw",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#BAE6FD",
                fontFamily: "'Courier New', monospace",
                whiteSpace: "nowrap",
              }}
            >
              &gt; PROXY ROUTING
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.2)", alignSelf: "stretch" }} />
            <div style={{ display: "flex", gap: "3vw" }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: "1.1vw" }}>
                <span style={{ color: "#BAE6FD" }}>/api</span>
                <span style={{ opacity: 0.55 }}> → </span>
                <span>API Server (Express)</span>
              </div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: "1.1vw" }}>
                <span style={{ color: "#BAE6FD" }}>/review</span>
                <span style={{ opacity: 0.55 }}> → </span>
                <span>PhotoReviewHub (Vite SPA)</span>
              </div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: "1.1vw" }}>
                <span style={{ color: "#BAE6FD" }}>/</span>
                <span style={{ opacity: 0.55 }}> → </span>
                <span>PhotoClub (Vite SPA)</span>
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
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>B.2</div>
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
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>03</div>
          </div>
        </div>
      </div>
    </div>
  );
}
