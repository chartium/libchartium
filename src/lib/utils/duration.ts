import { isDayjs, type Dayjs } from "./dayjs.js";

const DIVIDE_MAX_ITERATION_COUNT = 10;
const DIVIDE_ITERATION_COUNT_WITHOUT_AVERAGING = 5;
const DIVIDE_OLD_ESTIMATE_WEIGHT = 0.5;

export interface DurationLike {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
  weeks?: number;
}

const durationPeriods: Array<keyof DurationLike> = [
  "years",
  "months",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "weeks",
];

// prettier-ignore
const ms = (d: DurationLike) =>
  (((d.hours ?? 0)*60 + (d.minutes ?? 0))*60 + (d.seconds ?? 0))*1000 + (d.milliseconds ?? 0);

export class Duration implements DurationLike {
  public readonly isContextDependent: boolean;
  public readonly timeAsMilliseconds: number;

  private constructor(
    public readonly years: number,
    public readonly months: number,
    public readonly days: number,
    public readonly hours: number,
    public readonly minutes: number,
    public readonly seconds: number,
    public readonly milliseconds: number,
    public readonly weeks: number,
  ) {
    this.isContextDependent =
      years !== 0 || months !== 0 || days !== 0 || weeks !== 0;

    this.timeAsMilliseconds = ms(this);
  }

  static from({
    years,
    months,
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
    weeks,
  }: DurationLike) {
    return new Duration(
      years ?? 0,
      months ?? 0,
      days ?? 0,
      hours ?? 0,
      minutes ?? 0,
      seconds ?? 0,
      milliseconds ?? 0,
      weeks ?? 0,
    );
  }

  static diff(a: Dayjs, b: Dayjs) {
    return Duration.from({
      milliseconds: +b - +a,
    });
  }

  entries(): Iterable<[keyof DurationLike, number]> {
    const self = this;
    return (function* () {
      for (const period of durationPeriods) {
        if (self[period] === 0) continue;
        yield [period, self[period]];
      }
    })();
  }

  isEqual(d: DurationLike) {
    if (this.years !== d.years ?? 0) return false;
    if (this.months !== d.months ?? 0) return false;
    if (this.days !== d.days ?? 0) return false;
    if (this.weeks !== d.weeks ?? 0) return false;

    return ms(this) === ms(d);
  }

  multiply(s: number) {
    return new Duration(
      this.years * s,
      this.months * s,
      this.days * s,
      this.hours * s,
      this.minutes * s,
      this.seconds * s,
      this.milliseconds * s,
      this.weeks * s,
    );
  }

  add(duration: DurationLike): Duration;
  add(date: Dayjs): Dayjs;
  add(d: DurationLike | Dayjs): Duration | Dayjs {
    if (isDayjs(d)) return this.addDate(d);
    return this.addDuration(d);
  }

  private addDuration(d: DurationLike) {
    return new Duration(
      this.years + (d.years ?? 0),
      this.months + (d.months ?? 0),
      this.days + (d.days ?? 0),
      this.hours + (d.hours ?? 0),
      this.minutes + (d.minutes ?? 0),
      this.seconds + (d.seconds ?? 0),
      this.milliseconds + (d.milliseconds ?? 0),
      this.weeks + (d.weeks ?? 0),
    );
  }
  private addDate(d: Dayjs) {
    [...this.entries()]
      .map(([period, value]) => {
        const roundedValue = Math.floor(value);
        const diff = value - roundedValue;

        d = d.add(roundedValue, period);
        return <const>[period, diff];
      })
      .filter(([_, v]) => v !== 0)
      .map(([period, value]) => {
        const start = d.startOf(period);
        const end = d.endOf(period);
        const diffInMs = +end - +start;
        const valueInMs = value * diffInMs;
        d = d.add(valueInMs, "milliseconds");
      });

    return d;
  }

  toMilliseconds(when: Dayjs) {
    return +this.add(when) - +when;
  }

  divide(from: Dayjs, to: Dayjs) {
    const rangeLength = +to - +from;
    if (!this.isContextDependent) {
      return rangeLength / this.timeAsMilliseconds;
    }

    let avgLengthEstimate = this.toMilliseconds(from);
    let factor = 1;

    for (let i = 0; i < DIVIDE_MAX_ITERATION_COUNT; i++) {
      factor = rangeLength / avgLengthEstimate;
      const realLength = +this.multiply(factor).add(from) - +from;
      const newAvgLengthEstimate = realLength / factor;
      if (newAvgLengthEstimate === avgLengthEstimate) return factor;
      if (i < DIVIDE_ITERATION_COUNT_WITHOUT_AVERAGING) {
        avgLengthEstimate = newAvgLengthEstimate;
      } else {
        avgLengthEstimate =
          (DIVIDE_OLD_ESTIMATE_WEIGHT * avgLengthEstimate +
            newAvgLengthEstimate) /
          (1 + DIVIDE_OLD_ESTIMATE_WEIGHT);
      }
    }

    console.warn(
      `Duration division did not converge in ${DIVIDE_MAX_ITERATION_COUNT} steps.`,
      this,
      from,
      to,
    );

    return factor;
  }
}
