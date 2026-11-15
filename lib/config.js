export const ASSIGNABLE_ROLES = ["admin", "member", "guest"];
export const WORK_END_TIME = "16:00";
const [WORK_END_HOUR, WORK_END_MINUTE] = WORK_END_TIME.split(":").map(Number);
export const WORK_END_MINUTES = WORK_END_HOUR * 60 + WORK_END_MINUTE;

export const CURRENT_YEAR_OPTIONS = ["I", "II", "III", "IV"];
export const GENDER_OPTIONS = ["Male", "Female"];
export const RESIDENCE_OPTIONS = ["HOSTEL", "DAYSCHOLAR"];
export const HOSTEL_OPTIONS = [
  "FDR",
  "EGR",
  "SRR",
  "SRR EXT",
  "EVR",
  "OPRAH",
  "DMR",
  "PRG",
  "AR",
  "HR",
  "BOBRAJ",
  "JMR",
  "JVR",
  "BETHANY",
];

export const ROLE_HOME = {
  superadmin: "/superadmin",
  admin: "/admin",
  member: "/member",
  guest: "/guest",
};
