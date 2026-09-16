"use client";

import React, { useEffect, useRef, memo } from 'react';

const TradingViewWidget: React.FC<{ htmlContent: string }> = ({ htmlContent }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current && htmlContent) {
      // Clear previous widget
      while (container.current.firstChild) {
        container.current.removeChild(container.current.firstChild);
      }

      // Parse the script from the HTML content
      const scriptRegex = /<script[^>]*src="([^"]+)"[^>]*>([\s\S]*?)<\/script>/;
      const match = htmlContent.match(scriptRegex);
      
      if (match && match[1] && match[2]) {
        const scriptSrc = match[1];
        const scriptContent = match[2];

        const script = document.createElement('script');
        script.src = scriptSrc;
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = scriptContent;
        
        container.current.appendChild(script);
      } else {
        // Fallback for simple HTML if no script is found
        container.current.innerHTML = htmlContent;
      }
    }
  }, [htmlContent]);

  return <div ref={container} />;
};

export default memo(TradingViewWidget);
