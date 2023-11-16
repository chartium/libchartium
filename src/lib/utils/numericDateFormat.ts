import { Quantity, type Unit } from "../types.js";
import { SI } from "unitlib/systems";
import dayjs from "dayjs";

const nanoseconds = SI.parseUnit("ns");
const milliseconds = SI.parseUnit("ms");
const seconds = SI.parseUnit("s");
const minutes = seconds.multiply(60);
const hours = minutes.multiply(60);

export class NumericDateFormat {
  constructor(
    public readonly unit: Unit,
    public readonly relativeTo = new Date(0)
  ) {}

  parseToDate(value: number): Date {
    return new Date(new Quantity(value, this.unit).inUnits(milliseconds).value);
  }

  parseToDayjs(value: number): dayjs.Dayjs {
    return dayjs(new Quantity(value, this.unit).inUnits(milliseconds).value);
  }

  valueFrom(date: Date | dayjs.Dayjs): number {
    return new Quantity(+date, milliseconds).inUnits(this.unit).value;
  }

  static EpochNanoseconds = new NumericDateFormat(nanoseconds);
  static EpochMilliseconds = new NumericDateFormat(milliseconds);
  static EpochSeconds = new NumericDateFormat(seconds);
  static EpochMinutes = new NumericDateFormat(minutes);
  static EpochHours = new NumericDateFormat(hours);
}
