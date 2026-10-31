import { z } from 'zod';
import { optionalText, requiredText, uuidList } from './common';

export const locationSchema = z.object({
  name: requiredText(),
  address: optionalText(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(30, 'Bán kính từ 30 đến 500 m').max(500, 'Bán kính từ 30 đến 500 m'),
  positionIds: uuidList,
});

export type LocationInput = z.infer<typeof locationSchema>;
