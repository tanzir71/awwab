
import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="py-4 mt-auto w-full">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center text-center text-xs text-foreground">
          <div className="flex items-center mb-2 md:mb-0 mx-auto md:mx-0">
            Made with <Heart className="h-3 w-3 mx-1 text-red-500 fill-red-500" /> by <a href="https://tanziro.com" className="ml-1 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">tanziro.com</a>
          </div>
          <div className="mx-auto md:mx-0">
            Disclaimer: All data is stored in your browser's local cache.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
