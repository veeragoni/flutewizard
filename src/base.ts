/** A path inside the site, so links and files work when it's served from a sub-folder (GitHub Pages). */
export const at = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '');
