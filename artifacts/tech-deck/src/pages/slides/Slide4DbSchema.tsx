export default function Slide4DbSchema() {
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
              Section 04
            </div>
            <div style={{ fontSize: "1vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
              DATA MODEL
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
            <div style={{ fontSize: "1vw", fontFamily: "'Courier New', monospace" }}>DB-04C</div>
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
            DB SCHEMA
          </h2>

          {/* Two schema panels side by side */}
          <div style={{ display: "flex", gap: "3vw", marginBottom: "2.5vh" }}>
            {/* PhotoClub */}
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "2vh 1.5vw",
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
                  marginBottom: "1.2vh",
                }}
              >
                &gt; PHOTOCLUB
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ fontSize: "1.2vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>clubs</span>
                  <div style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "1vw", opacity: 0.6, fontFamily: "'Courier New', monospace" }}>id · name · description</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ fontSize: "1.2vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>themes</span>
                  <div style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "1vw", opacity: 0.6, fontFamily: "'Courier New', monospace" }}>id · name · club_id</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ fontSize: "1.2vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>photographers</span>
                  <div style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "1vw", opacity: 0.6, fontFamily: "'Courier New', monospace" }}>id · name · bio</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ fontSize: "1.2vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>photos</span>
                  <div style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "1vw", opacity: 0.6, fontFamily: "'Courier New', monospace" }}>id · title · likes · club_id</span>
                </div>
              </div>
            </div>

            {/* ReviewClub */}
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
                  marginBottom: "1.2vh",
                }}
              >
                &gt; REVIEWCLUB
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ fontSize: "1.2vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>review_sessions</span>
                  <div style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "1vw", opacity: 0.6, fontFamily: "'Courier New', monospace" }}>id · title · status</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ fontSize: "1.2vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>session_photos</span>
                  <div style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "1vw", opacity: 0.6, fontFamily: "'Courier New', monospace" }}>session_id · photo_id</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ fontSize: "1.2vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>session_reviewers</span>
                  <div style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "1vw", opacity: 0.6, fontFamily: "'Courier New', monospace" }}>session_id · user_id</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <span style={{ fontSize: "1.2vw", fontWeight: 700, fontFamily: "'Courier New', monospace" }}>photo_reviews</span>
                  <div style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: "1vw", opacity: 0.6, fontFamily: "'Courier New', monospace" }}>photo_id · stars · note</span>
                </div>
              </div>
            </div>
          </div>

          {/* ORM note */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "1.5vh 1.5vw",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              gap: "3vw",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.65vw",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#BAE6FD",
                  fontFamily: "'Courier New', monospace",
                  marginRight: "1vw",
                }}
              >
                &gt; ORM
              </span>
              <span style={{ fontSize: "1.05vw", fontFamily: "'Courier New', monospace" }}>
                Drizzle — push-based migrations in dev, schema-first types
              </span>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.15)" }} />
            <div>
              <span
                style={{
                  fontSize: "0.65vw",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#BAE6FD",
                  fontFamily: "'Courier New', monospace",
                  marginRight: "1vw",
                }}
              >
                &gt; FK CASCADES
              </span>
              <span style={{ fontSize: "1.05vw", fontFamily: "'Courier New', monospace" }}>
                Enforced in app layer — manual cascade order in route handlers
              </span>
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
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>CURRENT</div>
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
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>C.3</div>
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
            <div style={{ fontSize: "0.9vw", fontFamily: "'Courier New', monospace" }}>04</div>
          </div>
        </div>
      </div>
    </div>
  );
}
