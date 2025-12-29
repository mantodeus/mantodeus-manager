import { Streamdown, defaultRehypePlugins, defaultRemarkPlugins } from "streamdown";

const enableMath = import.meta.env.VITE_ENABLE_MATH === "true";

const rehypePlugins = Object.entries(defaultRehypePlugins)
  .filter(([key]) => enableMath || key !== "katex")
  .map(([, plugin]) => plugin);

const remarkPlugins = Object.entries(defaultRemarkPlugins)
  .filter(([key]) => enableMath || key !== "math")
  .map(([, plugin]) => plugin);

export function Markdown({ children }: { children: string }) {
  return (
    <Streamdown rehypePlugins={rehypePlugins} remarkPlugins={remarkPlugins}>
      {children}
    </Streamdown>
  );
}
