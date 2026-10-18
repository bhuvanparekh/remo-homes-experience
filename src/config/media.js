/**
 * Every image the site shows, by role.
 *
 * All of these are ReMo's own renders, taken from remo.homes/our-homes and
 * re-encoded to webp under public/media. Paths go through BASE_URL so they
 * resolve both locally ('/') and on GitHub Pages ('/<repo-name>/').
 */
const url = (file) => `${import.meta.env.BASE_URL}media/${file}`

export const MEDIA = {
  wordmark: url('remo-wordmark.webp'),
  icon: url('remo-icon.png'),

  /** No-WebGL fallback behind the captions. */
  twilight: url('twilight.webp'),

  rooms: {
    entry: url('entry-twilight.webp'),
    living: url('living.webp'),
    kitchen: url('kitchen.webp'),
    dining: url('dining.webp'),
    primarySuite: url('primary-suite.webp'),
    bath: url('bath.webp'),
  },
}
