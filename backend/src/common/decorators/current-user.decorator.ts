import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUser = {
  userId: string;
  tenantId: string;
  clientId: string;
  role: string;
  email: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return req.user;
  },
);
