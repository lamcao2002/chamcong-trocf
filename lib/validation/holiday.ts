import { z } from 'zod';
import { isoDate, requiredText } from './common';

export const holidaySchema = z.object({ date: isoDate, name: requiredText() });
export const holidayYearSchema = z.coerce.number().int().min(2000).max(2100);

export type HolidayInput = z.infer<typeof holidaySchema>;
