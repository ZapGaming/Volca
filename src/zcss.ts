export interface ZCSSRuleset {
    selector: string;
    params: Record<string, any>;
    libs: string[];
}

export class ZCSSEngine {
    static parse(script: string): ZCSSRuleset[] {
        const rulesets: ZCSSRuleset[] = [];
        
        // Remove comments
        const clean = script.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Find blocks: SELECTOR { CONTENT }
        const regex = /([#\.\w\-\_]+)\s*\{([^}]+)\}/g;
        let match;

        while ((match = regex.exec(clean)) !== null) {
            const selector = match[1].trim();
            const body = match[2].trim();
            const params: Record<string, any> = {};
            const libs: string[] = [];

            body.split(';').forEach(line => {
                const parts = line.split(':');
                if (parts.length < 2) return;
                
                const key = parts[0].trim();
                const value = parts[1].trim();

                // Advanced ZCSS Logic
                if (key === 'import') {
                    // Logic to handle imports
                    const libName = value.replace(/['"]/g, '');
                    libs.push(libName);
                } else if (key === 'render-mode') {
                    params['mode'] = value;
                } else if (key.startsWith('physics-')) {
                    // physics-gravity -> gravity
                    params[key.replace('physics-', '')] = parseFloat(value);
                } else if (key === 'model-source') {
                    // clean url('...')
                    params['model'] = value.match(/url\(['"]?(.*?)['"]?\)/)?.[1];
                } else if (key === 'count') {
                    params['count'] = parseInt(value);
                }
            });

            rulesets.push({ selector, params, libs });
        }
        return rulesets;
    }

    static async injectLibrary(libUrl: string) {
        console.log(`[ZCSS] Importing Dynamic Library: ${libUrl}`);
        // Check if CDN or local
        if (!libUrl.startsWith('http')) {
            // Mapping known internal libs for security or expansion
            console.log('Internal lib mapping not set, strictly purely loading module.');
        }
        // In a full implementation, you'd use dynamic import() or append <script>
        return true;
    }
}
