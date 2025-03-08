
export interface RakatInfo {
  sunnah?: number;
  sunnah2?: number;
  fard?: number;
  nafl?: number;
  witr?: number;
  total: number;
}

export interface Prayer {
  name: string;
  time: string;
  rakats: RakatInfo;
  prayerOrder: string;
  isCompleted?: boolean;
  isNext?: boolean;
}
