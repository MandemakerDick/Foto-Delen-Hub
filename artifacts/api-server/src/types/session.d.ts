import "express-session";

declare module "express-session" {
  interface SessionData {
    inviteGranted?: boolean;
    inviteTokenId?: number;
    adminId?: number;
  }
}
