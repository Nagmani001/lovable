export interface EmailConfig {
  resendApiKey?: string;
  smtp?: {
    host: string;
    port: number;
    user?: string;
    password?: string;
  };
}
