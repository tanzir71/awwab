export const SHARE_URL = "https://tanzir71.github.io/awwab/";
export const IS_PREVIEW = import.meta.env?.MODE === "preview" || import.meta.env?.MODE === "review";
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
