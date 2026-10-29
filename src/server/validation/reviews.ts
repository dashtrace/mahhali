import { IdParam, SlugParam } from "./common";
import { z } from "./zod";

const ReviewStatus = z.enum(["PUBLISHED", "HIDDEN"]).openapi("ReviewStatus");

export const SubmitReviewsBody = z
  .object({
    items: z
      .array(
        z.object({
          orderItemId: z.string().min(1).max(64),
          rating: z.number().int().min(1).max(5),
          comment: z
            .string()
            .trim()
            .max(1000)
            .optional()
            .transform((v) => v || null),
        }),
      )
      .min(1)
      .max(50),
  })
  .refine((b) => new Set(b.items.map((i) => i.orderItemId)).size === b.items.length, {
    message: "Each item can be reviewed once",
    path: ["items"],
  })
  .openapi("SubmitReviewsBody");

export const ProductReviewsParams = SlugParam.extend(IdParam.shape);

export const ListReviewsQuery = z.object({ status: ReviewStatus.optional() });

export const ModerateReviewBody = z.object({ status: ReviewStatus }).openapi("ModerateReviewBody");

export type SubmitReviewsInput = z.infer<typeof SubmitReviewsBody>;
export type ReviewStatusValue = z.infer<typeof ReviewStatus>;
