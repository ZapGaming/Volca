export interface ZCSSRule {
    selector: string;
    properties: Record<string, string>;
}

export class ZCSSEngine {
    static parse(css: string): ZCSSRule[] {
        const rules: ZCSSRule[] = [];
        // Remove comments
        const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
        // Regex for 'selector { content }'
        const re = /([#\.\w\-\_]+)\s*\{([^}]+)\}/g;
        let match;
        
        while((match = re.exec(clean)) !== null) {
            const selector = match[1].trim();
            const body = match[2].trim();
            const props: Record<string, string> = {};
            
            body.split(';').forEach(line => {
                const parts = line.split(':');
                if(parts.length < 2) return;
                props[parts[0].trim()] = parts[1].trim();
            });
            rules.push({ selector, properties: props });
        }
        return rules;
    }
}
