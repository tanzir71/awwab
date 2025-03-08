
import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="py-4 mt-auto w-full bg-transparent md:bg-gray-50 dark:md:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <div className="mb-2 md:mb-0">
            Made with <Heart className="h-3 w-3 mx-1 text-red-500 fill-red-500 inline" /> by <a href="https://tanziro.com" className="ml-1 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">tanziro.com</a>
          </div>
          <div>
            Disclaimer: All data is stored in your browser's local cache.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
