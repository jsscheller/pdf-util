export type ImageFormat = JpegImageFormat | PngImageFormat;
export enum ImageFormatType {
  Jpeg = "jpeg",
  Png = "png",
}

export type JpegImageFormat = {
  type: ImageFormatType.Jpeg;
  /**
   * @default 92
   * @picker range {"min": 0, "max": 100}
   */
  quality?: number;
};

export type PngImageFormat = {
  type: ImageFormatType.Png;
};
