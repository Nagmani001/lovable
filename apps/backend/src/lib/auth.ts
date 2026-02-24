import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@repo/database/client";
import { sendEmail } from "@repo/email/email";
import OtpTemplate from "@repo/email/template/OtpTemplate";

export const auth = betterAuth({
  trustedOrigins: ["http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "sign-in") {
          console.log("signin");
        } else if (type === "email-verification") {
          sendEmail({
            to: email,
            react: OtpTemplate({ otp }),
            subject: "email-verification Otp",
          });
        } else {
          console.log("password reset");
        }
      },
    }),
  ],
});
