import type { useSignIn } from '@clerk/expo';

type SignIn = NonNullable<ReturnType<typeof useSignIn>['signIn']>;
type Result = { error: unknown };
const checked = async (request: Promise<Result>) => {
  const result = await request;
  if (result.error) throw result.error;
};

export async function passwordSignIn(signIn: SignIn, email: string, password: string) {
  await checked(signIn.password({ emailAddress: email.trim(), password }));
}

export async function sendSignInCode(signIn: SignIn, email: string, resetPassword: boolean) {
  await signIn.reset();
  if (resetPassword) {
    await checked(signIn.create({ identifier: email.trim() }));
    await checked(signIn.resetPasswordEmailCode.sendCode());
  } else {
    await checked(signIn.emailCode.sendCode({ emailAddress: email.trim() }));
  }
}

export async function verifySignInCode(signIn: SignIn, code: string, resetPassword: boolean) {
  await checked(resetPassword
    ? signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() })
    : signIn.emailCode.verifyCode({ code: code.trim() }));
}

export async function submitNewPassword(signIn: SignIn, password: string) {
  await checked(signIn.resetPasswordEmailCode.submitPassword({ password }));
}

export function oauthScheme(isExpoGo: boolean, productionProxy?: string): 'exps' | undefined {
  // Published Expo Go callbacks must fetch the manifest over HTTPS.
  // Development and installed builds keep Expo's normal scheme resolution.
  return isExpoGo && productionProxy ? 'exps' : undefined;
}