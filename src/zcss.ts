export class ZCSSEngine {
    static parse(str: string): Record<string, any>[] {
        const blocks: any[] = [];
        const regex = /([#.a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
        let match;
        while((match = regex.exec(str)) !== null) {
            const props: any = {};
            match[2].split(';').forEach(l => {
                const [k, v] = l.split(':');
                if(k && v) props[k.trim()] = v.trim();
            });
            blocks.push({ selector: match[1].trim(), props });
        }
        return blocks;
    }
}
