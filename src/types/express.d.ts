import { ILink } from './link';

declare global {
  namespace Express {
    interface Request {
      link?: ILink;
    }
  }
}

export {};