// Minimalist 3-bar Audio Equalizer Lottie animation (used during 30s Apple Music preview)
export const EQUALIZER_LOTTIE = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 30,
  w: 24,
  h: 24,
  nm: "equalizer",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: "bar1", sr: 1,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [6, 20, 0] }, a: { a: 0, k: [0, 8, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 35, 100], e: [100, 100, 100] },
            { t: 10, s: [100, 100, 100], e: [100, 45, 100] },
            { t: 20, s: [100, 45, 100], e: [100, 35, 100] },
            { t: 30, s: [100, 35, 100] }
          ]
        }
      },
      shapes: [
        { ty: "rc", d: 1, s: { a: 0, k: [3.2, 16] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 2 } },
        { ty: "fl", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 } }
      ],
      ip: 0, op: 30, st: 0
    },
    {
      ddd: 0, ind: 2, ty: 4, nm: "bar2", sr: 1,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [12, 20, 0] }, a: { a: 0, k: [0, 8, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 95, 100], e: [100, 30, 100] },
            { t: 15, s: [100, 30, 100], e: [100, 95, 100] },
            { t: 30, s: [100, 95, 100] }
          ]
        }
      },
      shapes: [
        { ty: "rc", d: 1, s: { a: 0, k: [3.2, 16] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 2 } },
        { ty: "fl", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 } }
      ],
      ip: 0, op: 30, st: 0
    },
    {
      ddd: 0, ind: 3, ty: 4, nm: "bar3", sr: 1,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [18, 20, 0] }, a: { a: 0, k: [0, 8, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 50, 100], e: [100, 90, 100] },
            { t: 12, s: [100, 90, 100], e: [100, 28, 100] },
            { t: 22, s: [100, 28, 100], e: [100, 50, 100] },
            { t: 30, s: [100, 50, 100] }
          ]
        }
      },
      shapes: [
        { ty: "rc", d: 1, s: { a: 0, k: [3.2, 16] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 2 } },
        { ty: "fl", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 } }
      ],
      ip: 0, op: 30, st: 0
    }
  ]
};

// Subtle pulse dot Lottie animation for unlocked achievements / live status
export const PULSE_SPARK_LOTTIE = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 45,
  w: 24,
  h: 24,
  nm: "spark",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: "ring", sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [80], e: [0] }, { t: 45, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [12, 12, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [35, 35, 100], e: [110, 110, 100] }, { t: 45, s: [110, 110, 100] }] }
      },
      shapes: [
        { ty: "el", d: 1, s: { a: 0, k: [16, 16] }, p: { a: 0, k: [0, 0] } },
        { ty: "st", c: { a: 0, k: [1, 0.2, 0.4, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 } }
      ],
      ip: 0, op: 45, st: 0
    },
    {
      ddd: 0, ind: 2, ty: 4, nm: "core", sr: 1,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [12, 12, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }
      },
      shapes: [
        { ty: "el", d: 1, s: { a: 0, k: [6, 6] }, p: { a: 0, k: [0, 0] } },
        { ty: "fl", c: { a: 0, k: [1, 0.2, 0.4, 1] }, o: { a: 0, k: 100 } }
      ],
      ip: 0, op: 45, st: 0
    }
  ]
};
