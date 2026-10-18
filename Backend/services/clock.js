// Server clock used by attendance/leave/job logic. All business timestamps
// come from here (never from the client). Tests may pin the clock with
// setClock(); production code never calls it.
let override = null;

export const now = () => (override ? new Date(override()) : new Date());

export const setClock = (value) => {
  if (value === null || value === undefined) {
    override = null;
  } else if (typeof value === "function") {
    override = value;
  } else {
    const t = new Date(value).getTime();
    override = () => t;
  }
};

export default { now, setClock };
