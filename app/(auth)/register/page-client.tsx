
"use client";

import {
  RegisterProvider,
  useRegisterContext,
} from "@/components/auth/register/context";
import { SignUpForm } from "@/components/auth/sign-up";
import { truncate } from "@/libs/utils/truncate";

export default function RegisterPageClient() {
  return (
    <RegisterProvider>
      <RegisterFlow />
    </RegisterProvider>
  );
}

function SignUp() {
  return <SignUpForm />;
}

function Verify() {
  const { email } = useRegisterContext();

  return (
    <>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-center text-xl font-semibold">
            Verify your email
          </h3>
          <p className="text-base font-medium text-neutral-500">
            We sent a verification link to{" "}
            <strong className="font-semibold text-neutral-600" title={email}>
              {truncate(email, 30)}
            </strong>. Check your inbox and click the link to finish signup.
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            If you do not see it, check your spam or promotions folder.
          </p>
        </div>
       
      </div>
    </>
  );
}

const RegisterFlow = () => {
  const { step } = useRegisterContext();

  if (step === "signup") return <SignUp />;
  if (step === "verify") return <Verify />;
};
