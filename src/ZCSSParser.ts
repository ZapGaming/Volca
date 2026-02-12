// A lightweight CSS-like parser
export interface ZCSSRule {
    selector: string;
    properties: Record<string, string>;
}

export class ZCSSParser {
    static parse(cssString: string): ZCSSRule[] {
        // Remove comments
        const clean = cssString.replace(/\/\*[\s\S]*?\*\//g, "");
        const rules: ZCSSRule[] = [];
        
        // Regex to capture Selector { body }
        const ruleRegex = /([#\.a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
        
        let match;
        while ((match = ruleRegex.exec(clean)) !== null) {
            const selector = match[1].trim();
            const body = match[2].trim();
            
            const properties: Record<string, string> = {};
            const propsRegex = /([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
            let propMatch;
            
            while ((propMatch = propsRegex.exec(body)) !== null) {
                properties[propMatch[1].trim()] = propMatch[2].trim();
            }
            
            rules.push({ selector, properties });
        }
        
        return rules;
    }

    static async loadGLBVertices(url: string): Promise<Float32Array> {
        // Pseudo-loader: In production, use 'gltf-transform' or basic binary parser
        // ensuring we extract the vertex POSITIONS for particle spawn points
        console.log(`ZCSS: Loading geometric core from ${url}...`);
        
        // Return dummy sphere data for now so it works without external library dependencies for this demo
        const vertices = [];
        for(let i=0; i<1000; i++) {
             vertices.push(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5);
        }
        return new Float32Array(vertices);
    }
}
