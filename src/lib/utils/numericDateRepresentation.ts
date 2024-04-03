import { Quantity, type Unit } from "../types.js";
import { SI } from "unitlib/systems";
import dayjs from "dayjs";

const nanoseconds = SI.parseUnit("ns");
const milliseconds = SI.parseUnit("ms");
const seconds = SI.parseUnit("s");
const minutes = seconds.multiply(60);
const hours = minutes.multiply(60);

export class NumericDateRepresentation {
  constructor(
    public readonly unit: Unit,
    public readonly relativeTo = new Date(0),
  ) {
    Object.freeze(this);
  }

  parseToDate(value: number): Date {
    return new Date(new Quantity(value, this.unit).inUnits(milliseconds).value);
  }

  parseToDayjs(value: number): dayjs.Dayjs {
    return dayjs(new Quantity(value, this.unit).inUnits(milliseconds).value);
  }

  valueFrom(date: Date | dayjs.Dayjs): number {
    return new Quantity(+date, milliseconds).inUnits(this.unit).value;
  }

  isEqual(other: NumericDateRepresentation) {
    return this.unit === other.unit && +this.relativeTo === +other.relativeTo;
  }

  static EpochNanoseconds = new NumericDateRepresentation(nanoseconds);
  static EpochMilliseconds = new NumericDateRepresentation(milliseconds);
  static EpochSeconds = new NumericDateRepresentation(seconds);
  static EpochMinutes = new NumericDateRepresentation(minutes);
  static EpochHours = new NumericDateRepresentation(hours);
}
