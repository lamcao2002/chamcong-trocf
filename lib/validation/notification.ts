import { z } from 'zod';
import { uuidList } from './common';

export const notificationReadSchema = z.object({ ids: uuidList.optional() });

export type NotificationReadInput = z.infer<typeof notificationReadSchema>;
