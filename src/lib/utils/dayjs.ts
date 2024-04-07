import dayjs from "dayjs";

import dayjs_utc from "dayjs/plugin/utc.js";
dayjs.extend(dayjs_utc);

// import dayjs_tz from "dayjs/plugin/timezone.js";
// dayjs.extend(dayjs_tz);

export type Dayjs = dayjs.Dayjs;
export const isDayjs = dayjs.isDayjs;

export { dayjs };
