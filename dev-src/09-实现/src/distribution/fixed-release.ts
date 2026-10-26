/** A fixed loader embeds this root of trust; it is never downloaded from main. */
export type FixedRelease={schema:1;repository:'Adirm007/Protelysion';version:string;sourceCommit:string;manifestSha256:string};
export function fixedReleaseScope(release:FixedRelease):string {
 if(release.schema!==1||release.repository!=='Adirm007/Protelysion'||!/^\d{1,8}(?:\.\d{1,8}){1,5}$/.test(release.version)||!/^[a-f0-9]{40}$/.test(release.sourceCommit)||!/^[a-f0-9]{64}$/.test(release.manifestSha256))throw Error('固定版发布信息无效');
 return `protelysion-fixed-v1:${release.repository}:${release.version}:${release.manifestSha256}`;
}
export function fixedReleaseBases(release:FixedRelease):URL[] {
 fixedReleaseScope(release);
 return [
  `https://raw.githubusercontent.com/${release.repository}/${release.sourceCommit}/site/`,
  `https://cdn.jsdelivr.net/gh/${release.repository}@${release.sourceCommit}/site/`,
  `https://fastly.jsdelivr.net/gh/${release.repository}@${release.sourceCommit}/site/`,
 ].map(value=>new URL(value));
}
