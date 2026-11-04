import { z } from "zod";
const responseSchema = z.object({
  Results: z
    .array(
      z.object({
        Make: z.string().optional(),
        Model: z.string().optional(),
        ModelYear: z.string().optional(),
        Trim: z.string().optional(),
        ErrorCode: z.string().optional(),
        ErrorText: z.string().optional(),
      }),
    )
    .min(1),
});
export function parseVinResponse(input: unknown) {
  const result = responseSchema.parse(input).Results[0];
  const year = Number(result.ModelYear);
  if (
    !result.Make ||
    !result.Model ||
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2100
  )
    throw new Error(
      "NHTSA couldn’t identify this VIN. Check it or enter the vehicle details manually.",
    );
  return {
    make: result.Make,
    model: result.Model,
    year: String(year),
    trim: result.Trim ?? "",
    warning: result.ErrorCode?.split(",").some((code) => code.trim() !== "0")
      ? "NHTSA returned a VIN warning. Verify the VIN and decoded details before saving."
      : null,
  };
}
