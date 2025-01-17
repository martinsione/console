import { Issue } from "@console/core/issue";
import { unzipSync } from "zlib";
import { withActor } from "@console/core/actor";
import { Handler } from "sst/context";
import { KinesisStreamEvent, KinesisStreamBatchResponse } from "aws-lambda";

declare module "sst/context" {
  interface Handlers {
    kinesis_stream: {
      event: KinesisStreamEvent;
      response: KinesisStreamBatchResponse;
    };
  }
}

export const handler = Handler("kinesis_stream", (event) =>
  withActor(
    {
      type: "public",
      properties: {},
    },
    async () => {
      const incomplete: string[] = event.Records.map(
        (r) => r.eventID
      ).reverse();
      let timeout = false;
      setTimeout(() => {
        timeout = true;
      }, 1000 * 60);
      const { Records } = event;
      for (const record of Records) {
        if (timeout) break;
        const decoded = JSON.parse(
          unzipSync(Buffer.from(record.kinesis.data, "base64")).toString()
        );
        if (decoded.messageType !== "DATA_MESSAGE") {
          incomplete.pop();
          continue;
        }
        try {
          await Issue.extract(decoded);
          incomplete.pop();
        } catch (ex) {
          console.error(ex);
        }
      }

      const response = {
        batchItemFailures: incomplete.map((id) => ({
          itemIdentifier: id,
        })),
      };

      return response;
    }
  )
);
