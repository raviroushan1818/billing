import { BRAND } from '../brand';

type BrandLogoProps = {
  className?: string;
  width?: number;
  height?: number;
  /** Decorative when adjacent text already names the product */
  decorative?: boolean;
};

export function BrandLogo({
  className,
  width,
  height,
  decorative = false,
}: BrandLogoProps) {
  return (
    <img
      src={BRAND.logoSrc}
      alt={decorative ? '' : BRAND.logoAlt}
      className={className}
      width={width}
      height={height}
      decoding="async"
      {...(decorative ? { 'aria-hidden': true as const } : {})}
    />
  );
}
