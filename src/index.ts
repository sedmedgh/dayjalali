import { Dayjs, PluginFunc, ConfigType, OpUnitType, UnitType, ManipulateType } from 'dayjs'
import fa from 'dayjs/locale/fa'
import { toGregorian, toJalaali, jalaaliMonthLength } from 'jalaali-js'
import * as C from './constant'

interface DayjsUtils {
    prettyUnit: (unit: OpUnitType | string) => string
    isUndefined: (value: any) => boolean
    padStart: (string: string | number, length: number, pad: string) => string
    monthDiff: (a: Dayjs, b: Dayjs) => number
    absFloor: (n: number) => number
    p: (unit: OpUnitType | string) => string
    u: (value: any) => boolean
    s: (string: string | number, length: number, pad: string) => string
    m: (a: Dayjs, b: Dayjs) => number
    a: (n: number) => number
}

type JalaliUnitType = OpUnitType | 'date' | 'day' | 'month' | 'year'
type ExtendedOpUnitType = OpUnitType | 'date' | 'day' | 'month' | 'year'
type InstanceFactoryParams = {
    d: number
    m: number
    y?: number
}

interface ExtendedDayjs extends Omit<Dayjs, 'add' | 'year' | 'month' | 'date'> {
    $jy: number
    $jM: number
    $jD: number
    $C?: string
    $d: Date
    $y: number
    $M: number
    $D: number
    $W: number
    $H: number
    $m: number
    $s: number
    $ms: number
    $L: string
    $u?: boolean
    InitJalali: () => void
    parse: (cfg: any) => any
    init: (cfg?: any) => void
    $set: (unit: string, value: number) => ExtendedDayjs
    $g: (input: any, get: string, set: string) => any
    $locale: () => any
    isJalali: () => boolean
    calendar: (calendar: string) => ExtendedDayjs
    toArray: () => number[]
    $utils: () => DayjsUtils
    set: (unit: UnitType | string, value: number) => ExtendedDayjs
    endOf: (unit: OpUnitType) => ExtendedDayjs
    daysInMonth(): number
    startOf(unit: OpUnitType, startOf?: boolean): ExtendedDayjs
    add(value: number, unit?: ManipulateType): ExtendedDayjs
    year(): number
    year(value: number): ExtendedDayjs
    month(): number
    month(value: number): ExtendedDayjs
    date(): number
    date(value: number): ExtendedDayjs
}

interface ExtendedDayjsFactory {
    (date?: ConfigType, option?: any): ExtendedDayjs
    $C: string
    $fdow: number
    en: {
        jmonths: string[]
    }
    calendar: (calendar: string) => ExtendedDayjsFactory
    locale: (preset: string, object?: any, isLocal?: boolean) => string
}
type DayjsFunction = (this: ExtendedDayjs, ...args: any[]) => ExtendedDayjs | number | string | Date | any[]
type WrapperFunction = (action: DayjsFunction) => (this: ExtendedDayjs, ...args: any[]) => ExtendedDayjs

const plugin: PluginFunc = (option, dayjsClass, dayjsFactory) => {
  const proto = dayjsClass.prototype as ExtendedDayjs
  const factory = dayjsFactory as unknown as ExtendedDayjsFactory
  const U = proto.$utils()

  const $isJalali = (v: ExtendedDayjs): boolean => v.$C === 'jalali'
  const $prettyUnit = U.prettyUnit || U.p
  const $isUndefined = U.isUndefined || U.u
  const $padStart = U.padStart || U.s
  const $monthDiff = U.monthDiff || U.m
  const $absFloor = U.absFloor || U.a

  const wrapperOfTruth: WrapperFunction = (action) =>
    function (this: ExtendedDayjs, ...args: any[]): ExtendedDayjs {
      const unsure = action.bind(this)(...args) as ExtendedDayjs
      unsure.$C = this.$C
      if (unsure.isJalali()) {
        unsure.InitJalali()
      }
      return unsure
    }

  // keep calendar on date manipulation
  proto.startOf = wrapperOfTruth(proto.startOf)
  proto.endOf = wrapperOfTruth(proto.endOf)
  proto.add = wrapperOfTruth(proto.add)
  proto.subtract = wrapperOfTruth(proto.subtract as DayjsFunction)
  proto.set = wrapperOfTruth(proto.set)

  const oldParse = proto.parse
  const oldInit = proto.init
  const oldStartOf = proto.startOf
  const old$Set = proto.$set
  const oldAdd = proto.add
  const oldFormat = proto.format
  const oldDiff = proto.diff
  const oldYear = proto.year
  const oldMonth = proto.month
  const oldDate = proto.date
  const oldDaysInMonth = proto.daysInMonth
  const oldToArray = proto.toArray

  factory.$C = 'gregory'
  factory.$fdow = 6 // 0: sunday, ...

  factory.calendar = function (calendar: string): ExtendedDayjsFactory {
    factory.$C = calendar
    return factory
  }

  proto.calendar = function (calendar: string): ExtendedDayjs {
    const that = this.clone() as ExtendedDayjs
    that.$C = calendar
    if (that.isJalali()) {
      that.InitJalali()
    }
    return that
  }

  proto.isJalali = function (): boolean {
    return $isJalali(this as ExtendedDayjs)
  }

  factory.en = factory.en || {}
  factory.en.jmonths =
        'Farvardin_Ordibehesht_Khordaad_Tir_Mordaad_Shahrivar_Mehr_Aabaan_Aazar_Dey_Bahman_Esfand'.split('_')
  factory.locale('fa', { ...fa, ...C.fa }, true)

  const wrapper = function (date: Date | string | number, instance: ExtendedDayjs): ExtendedDayjs {
    return factory(date, {
      locale: instance.$L,
      utc: instance.$u,
      calendar: instance.$C
    }) as ExtendedDayjs
  }

  proto.init = function (cfg = {}) {
    oldInit.bind(this)(cfg)

    if (this.isJalali()) {
      this.InitJalali()
    }
  }

  proto.parse = function (cfg) {
    let reg: RegExpMatchArray | null = null
    this.$C = cfg.calendar || this.$C || factory.$C

    if (cfg.jalali &&
            typeof cfg.date === 'string' &&
            /.*[^Z]$/i.test(cfg.date)) {
      reg = cfg.date.match(C.REGEX_PARSE)
      if (reg) {
        const { gy: y, gm: m, gd: d } = toGregorian(
          parseInt(reg[1], 10),
          parseInt(reg[2], 10),
          parseInt(reg[3] || '1', 10)
        )
        cfg.date = `${y}-${m}-${d}${reg[4] || ''}`
      }
    }
    return oldParse.bind(this)(cfg)
  }

  proto.InitJalali = function () {
    const { jy, jm, jd } = toJalaali(this.$y, this.$M + 1, this.$D)
    this.$jy = jy
    this.$jM = jm - 1
    this.$jD = jd
  }

  // Update the instanceFactory functions
  const instanceFactory = (
    { d, m, y }: InstanceFactoryParams,
    context: ExtendedDayjs
  ): ExtendedDayjs => {
    const year = y ?? context.$jy
    const { gy, gm, gd } = toGregorian(year, m + 1, d)
    return wrapper(new Date(gy, gm - 1, gd), context)
  }

  // Update the startOf function
  proto.startOf = function (units: OpUnitType | ExtendedOpUnitType, startOf = true): ExtendedDayjs {
    const def = () => oldStartOf.bind(this)(units as OpUnitType, startOf) as ExtendedDayjs
    if (!$isJalali(this)) {
      return def()
    }

    const unit = ($prettyUnit(units as OpUnitType) as OpUnitType)
    const WModifier = (this.$W + (7 - factory.$fdow)) % 7

    switch (unit) {
    case C.Y:
      return startOf
        ? instanceFactory({ d: 1, m: 0 }, this)
        : instanceFactory({ d: 0, m: 0, y: (this.$jy || 0) + 1 }, this)
    case C.M:
      return startOf
        ? instanceFactory({ d: 1, m: this.$jM }, this)
        : instanceFactory({
          d: 0,
          m: ((this.$jM || 0) + 1) % 12,
          y: (this.$jy || 0) + Math.floor(((this.$jM || 0) + 1) / 12)
        }, this)
    case C.W:
      return startOf
        ? instanceFactory({ d: (this.$jD || 0) - WModifier, m: this.$jM }, this)
        : instanceFactory({ d: (this.$jD || 0) + (6 - WModifier), m: this.$jM }, this)
    default:
      return def()
    }
  }

  // Update the $set function
  proto.$set = function (units: string, value: number): ExtendedDayjs {
    const def = () => old$Set.bind(this)(units, value) as ExtendedDayjs
    if (!$isJalali(this)) {
      return def()
    }

    const unit = $prettyUnit(units as OpUnitType | string) as JalaliUnitType
    const d = this.$jD || 1
    const m = this.$jM || 0
    const y = this.$jy || 0

    switch (unit) {
    case C.DATE:
    case C.D:
      return instanceFactory({ d: value, m, y }, this)
    case C.M:
      return instanceFactory({ d, m: value, y }, this)
    case C.Y:
      return instanceFactory({ d, m, y: value }, this)
    default:
      return def()
    }
  }

  // Update add function
  proto.add = function (this: ExtendedDayjs, number: number, units?: ManipulateType): ExtendedDayjs {
    const def = () => oldAdd.bind(this)(number, units) as ExtendedDayjs
    if (!$isJalali(this)) {
      return def()
    }

    const num = Number(number)
    // Convert 'day' to 'd' which is a valid OpUnitType
    const defaultUnit: OpUnitType = 'd'
    const unit = units ? ($prettyUnit(units as OpUnitType) as OpUnitType) : defaultUnit

    const addInstanceFactory = (u: ManipulateType, n: number): ExtendedDayjs => {
      const date = this.set('date' as ManipulateType, 1).set(u, n + num)
      return date.set('date' as ManipulateType, Math.min(this.$jD || 0, date.daysInMonth()))
    }

    if (['M', 'month'].indexOf(unit) > -1) {
      const n = (this.$jM || 0) + num
      const y = n < 0 ? -Math.ceil(-n / 12) : Math.floor(n / 12)
      const d = this.$jD || 0
      const x = this.set('day' as ManipulateType, 1)
        .add(y, 'year' as ManipulateType)
        .set('month' as ManipulateType, n - y * 12)
      return x.set('day' as ManipulateType, Math.min(x.daysInMonth(), d))
    }

    if (['y', 'year'].indexOf(unit) > -1) {
      return addInstanceFactory('year' as ManipulateType, this.$jy || 0)
    }

    if (['d', 'day'].indexOf(unit) > -1) {
      const date = new Date(this.$d)
      date.setDate(date.getDate() + num)
      return wrapper(date, this)
    }

    return def()
  }

  // Update format function
  proto.format = function (formatStr?: string, localeObject?: any): string {
    if (!$isJalali(this)) {
      return oldFormat.bind(this)(formatStr || '')
    }

    const str = formatStr || C.FORMAT_DEFAULT
    const locale = localeObject || this.$locale()
    const { jmonths } = locale || { jmonths: [] }

    return str.replace(C.REGEX_FORMAT, (match: string) => {
      if (match.indexOf('[') > -1) return match.replace(/\[|\]/g, '')

      const jy = this.$jy || 0
      const jm = this.$jM || 0
      const jd = this.$jD || 0

      switch (match) {
      case 'YY':
        return String(jy).slice(-2)
      case 'YYYY':
        return String(jy)
      case 'M':
        return String(jm + 1)
      case 'MM':
        return $padStart(jm + 1, 2, '0')
      case 'MMM':
        return jmonths[jm]?.slice(0, 3) || ''
      case 'MMMM':
        return jmonths[jm] || ''
      case 'D':
        return String(jd)
      case 'DD':
        return $padStart(jd, 2, '0')
      default:
        return oldFormat.bind(this)(match)
      }
    })
  }

  // Update diff function
  proto.diff = function (this: ExtendedDayjs, input: ConfigType, units?: OpUnitType, float?: boolean): number {
    const def = () => oldDiff.bind(this)(input, units, float)
    if (!$isJalali(this)) {
      return def()
    }
    const unit = units ? $prettyUnit(units) : undefined
    const that = factory(input)
    let result = $monthDiff(this, that)

    switch (unit) {
    case C.Y:
      result /= 12
      break
    case C.M:
      break
    default:
      return def()
    }
    return float ? result : $absFloor(result)
  }

  // Update $g function
  proto.$g = function (this: ExtendedDayjs, input: any, get: string, set: string): any {
    if ($isUndefined(input)) return (this as any)[get]
    return this.set(set as ManipulateType, input)
  }

  // Update year function
  proto.year = function (this: ExtendedDayjs, input?: number): number | ExtendedDayjs {
    if (!$isJalali(this)) {
      return oldYear.bind(this)(input!)
    }
    if (typeof input === 'undefined') {
      return this.$jy || 0
    }
    return this.set('year' as ManipulateType, input)
  } as any

  // Update month function
  proto.month = function (this: ExtendedDayjs, input?: number): number | ExtendedDayjs {
    if (!$isJalali(this)) {
      return oldMonth.bind(this)(input!)
    }
    if (typeof input === 'undefined') {
      return this.$jM || 0
    }
    return this.set('month' as ManipulateType, input)
  } as any

  // Update date function
  proto.date = function (this: ExtendedDayjs, input?: number): number | ExtendedDayjs {
    if (!$isJalali(this)) {
      return oldDate.bind(this)(input!)
    }
    if (typeof input === 'undefined') {
      return this.$jD || 0
    }
    return this.set('date' as ManipulateType, input)
  } as any

  // Update daysInMonth function
  proto.daysInMonth = function (this: ExtendedDayjs): number {
    if (!$isJalali(this)) {
      return oldDaysInMonth.bind(this)()
    }
    return jalaaliMonthLength(this.$jy, this.$jM + 1)
  }

  // Update toArray function
  if (oldToArray) {
    proto.toArray = function (): number[] {
      if (!$isJalali(this)) {
        return oldToArray.bind(this)()
      }
      return [
        this.$jy || 0,
        this.$jM || 0,
        this.$jD || 0,
        this.$H || 0,
        this.$m || 0,
        this.$s || 0,
        this.$ms || 0
      ]
    }
  }

  proto.clone = function () {
    return  wrapper(this.toDate(), this)
  }
}

export default plugin
