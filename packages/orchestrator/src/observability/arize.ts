// Arize tracing for OpenAI SDK calls.
//
// Side-effect module: importing it once installs an OpenTelemetry tracer
// provider, wires an OTLP/gRPC exporter pointed at Arize Cloud, and
// manually instruments the OpenAI class so every chat.completions.create
// call emits a span. Manual instrumentation is used instead of the
// require/import hook because the backend runs as native ESM via tsx.
//
// Creds are hardcoded per current setup. Rotate before any public push.

import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { Metadata } from "@grpc/grpc-js";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import OpenAI from "openai";

const ARIZE_SPACE_ID = "U3BhY2U6NDQ5Njg6UGxTNQ==";
const ARIZE_API_KEY =
  "ak-0209d484-5ad6-4157-9f71-6f3258179699-nogjeIuRmJ4BPU3YRCxCPTVD07XN_8SD";
const PROJECT_NAME = "lovable-orchestrator";

const metadata = new Metadata();
metadata.set("space_id", ARIZE_SPACE_ID);
metadata.set("api_key", ARIZE_API_KEY);

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    // Arize semantic conventions — string keys to avoid version mismatch.
    model_id: PROJECT_NAME,
    "openinference.project.name": PROJECT_NAME,
  }),
  spanProcessors: [
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: "https://otlp.arize.com/v1",
        metadata,
      }),
    ),
  ],
});

provider.register();

const openAIInstrumentation = new OpenAIInstrumentation();
openAIInstrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [openAIInstrumentation],
});

console.log("[arize] tracing initialized for project", PROJECT_NAME);
