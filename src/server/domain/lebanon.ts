// Lebanon has no postcodes; couriers work from governorate, district (caza),
// area, street and a landmark.
export const GOVERNORATES = [
  "Akkar",
  "Baalbek-Hermel",
  "Beirut",
  "Beqaa",
  "Keserwan-Jbeil",
  "Mount Lebanon",
  "Nabatieh",
  "North",
  "South",
] as const;

export type Governorate = (typeof GOVERNORATES)[number];
