import { Quantity, type Unit, isUnit } from "../types.js";
import { dayjs, type Dayjs } from "./dayjs.js";
import { SI } from "unitlib/systems";
import { Duration } from "./duration.js";

const nanoseconds = SI.parseUnit("ns");
const milliseconds = SI.parseUnit("ms");
const seconds = SI.parseUnit("s");
const minutes = seconds.multiply(60);
const hours = minutes.multiply(60);

export const isNumericDateRepresentation = (
  x: unknown,
): x is NumericDateRepresentation => x instanceof NumericDateRepresentation;

export class NumericDateRepresentation {
  [Symbol.toStringTag] = "NumericDateRepresentation";

  private constructor(
    public readonly duration: Duration,
    public readonly relativeTo: Dayjs,
  ) {
    Object.freeze(this);
  }

  static from({
    duration,
    relativeTo,
  }: {
    duration: Duration | Unit;
    relativeTo?: Date | Dayjs;
  }) {
    if (isUnit(duration)) {
      duration = Duration.from({
        milliseconds: new Quantity(1, duration).inUnits(milliseconds).value,
      });
    }

    if (relativeTo === undefined) {
      relativeTo = dayjs.utc(0);
    } else if (relativeTo instanceof Date) {
      relativeTo = dayjs(relativeTo);
    }

    return new NumericDateRepresentation(duration, relativeTo);
  }

  convertToDayjs(value: number): Dayjs {
    return this.duration.multiply(value).add(this.relativeTo);
  }

  parseToDate(value: number): Date {
    return this.convertToDayjs(value).toDate();
  }

  valueFrom(date: Date | Dayjs): number {
    if (date instanceof Date) date = dayjs(date);
    return this.duration.divide(this.relativeTo, date);
  }

  isEqual(other: NumericDateRepresentation) {
    return (
      this.duration.isEqual(other.duration) &&
      +this.relativeTo === +other.relativeTo
    );
  }

  static EpochNanoseconds() {
    return NumericDateRepresentation.from({
      duration: nanoseconds,
    });
  }
  static EpochMilliseconds() {
    return NumericDateRepresentation.from({
      duration: milliseconds,
    });
  }
  static EpochSeconds() {
    return NumericDateRepresentation.from({
      duration: seconds,
    });
  }
  static EpochMinutes() {
    return NumericDateRepresentation.from({
      duration: minutes,
    });
  }
  static EpochHours() {
    return NumericDateRepresentation.from({ duration: hours });
  }
}
