"use client";

import { Fragment, type ReactNode } from "react";
import { Box, Link, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

type MarkdownMessageProps = {
  content: string;
};

type InlineMatch =
  | {
      kind: "link";
      index: number;
      fullMatch: string;
      label: string;
      href: string;
    }
  | {
      kind: "strong" | "emphasis" | "strikethrough" | "code";
      index: number;
      fullMatch: string;
      value: string;
    };

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const CODE_FENCE_PATTERN = /^```([^\n`]*)\s*$/;
const BLOCKQUOTE_PATTERN = /^>\s?(.*)$/;
const UNORDERED_LIST_PATTERN = /^[-*+]\s+(.*)$/;
const ORDERED_LIST_PATTERN = /^\d+\.\s+(.*)$/;

function isHorizontalRule(line: string) {
  return /^((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line.trim());
}

function isBlockStarter(line: string) {
  const trimmed = line.trimStart();
  return (
    !trimmed ||
    CODE_FENCE_PATTERN.test(trimmed) ||
    HEADING_PATTERN.test(trimmed) ||
    BLOCKQUOTE_PATTERN.test(trimmed) ||
    UNORDERED_LIST_PATTERN.test(trimmed) ||
    ORDERED_LIST_PATTERN.test(trimmed) ||
    isHorizontalRule(trimmed)
  );
}

function findNextInlineMatch(text: string): InlineMatch | null {
  const matches: InlineMatch[] = [];
  const linkMatch = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(text);
  if (linkMatch && linkMatch[0]) {
    matches.push({
      kind: "link",
      index: linkMatch.index,
      fullMatch: linkMatch[0],
      label: linkMatch[1],
      href: linkMatch[2],
    });
  }

  const strongMatch = /\*\*([\s\S]+?)\*\*/.exec(text) ?? /__([\s\S]+?)__/.exec(text);
  if (strongMatch && strongMatch[0]) {
    matches.push({
      kind: "strong",
      index: strongMatch.index,
      fullMatch: strongMatch[0],
      value: strongMatch[1],
    });
  }

  const emphasisMatch = /\*([^*\n][\s\S]*?)\*/.exec(text) ?? /_([^_\n][\s\S]*?)_/.exec(text);
  if (emphasisMatch && emphasisMatch[0]) {
    matches.push({
      kind: "emphasis",
      index: emphasisMatch.index,
      fullMatch: emphasisMatch[0],
      value: emphasisMatch[1],
    });
  }

  const strikethroughMatch = /~~([\s\S]+?)~~/.exec(text);
  if (strikethroughMatch && strikethroughMatch[0]) {
    matches.push({
      kind: "strikethrough",
      index: strikethroughMatch.index,
      fullMatch: strikethroughMatch[0],
      value: strikethroughMatch[1],
    });
  }

  const codeMatch = /`([^`\n]+)`/.exec(text);
  if (codeMatch && codeMatch[0]) {
    matches.push({
      kind: "code",
      index: codeMatch.index,
      fullMatch: codeMatch[0],
      value: codeMatch[1],
    });
  }

  if (!matches.length) {
    return null;
  }

  matches.sort((left, right) => left.index - right.index);
  return matches[0];
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let partIndex = 0;

  while (remaining) {
    const match = findNextInlineMatch(remaining);

    if (!match) {
      nodes.push(<Fragment key={`${keyPrefix}-text-${partIndex}`}>{remaining}</Fragment>);
      break;
    }

    if (match.index > 0) {
      nodes.push(
        <Fragment key={`${keyPrefix}-text-${partIndex}`}>
          {remaining.slice(0, match.index)}
        </Fragment>,
      );
      partIndex += 1;
    }

    const tokenKey = `${keyPrefix}-token-${partIndex}`;

    switch (match.kind) {
      case "link": {
        const isExternal = /^https?:\/\//.test(match.href);
        nodes.push(
          <Link
            key={tokenKey}
            href={match.href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer noopener" : undefined}
            underline="always"
            sx={{ overflowWrap: "anywhere" }}
          >
            {renderInlineMarkdown(match.label, `${tokenKey}-label`)}
          </Link>,
        );
        break;
      }
      case "strong":
        nodes.push(<Box key={tokenKey} component="strong">{renderInlineMarkdown(match.value, tokenKey)}</Box>);
        break;
      case "emphasis":
        nodes.push(<Box key={tokenKey} component="em">{renderInlineMarkdown(match.value, tokenKey)}</Box>);
        break;
      case "strikethrough":
        nodes.push(<Box key={tokenKey} component="s">{renderInlineMarkdown(match.value, tokenKey)}</Box>);
        break;
      case "code":
        nodes.push(
          <Box
            key={tokenKey}
            component="code"
            sx={(theme) => ({
              px: 0.6,
              py: 0.15,
              borderRadius: 0.75,
              bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.1 : 0.08),
              fontFamily:
                'ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: "0.92em",
            })}
          >
            {match.value}
          </Box>,
        );
        break;
    }

    remaining = remaining.slice(match.index + match.fullMatch.length);
    partIndex += 1;
  }

  return nodes;
}

function renderParagraph(text: string, key: string) {
  return (
    <Typography
      key={key}
      variant="body1"
      sx={{
        m: 0,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {renderInlineMarkdown(text, key)}
    </Typography>
  );
}

function renderHeading(level: number, text: string, key: string) {
  const normalizedLevel = Math.min(level, 6) as 1 | 2 | 3 | 4 | 5 | 6;
  const headingComponent = `h${normalizedLevel}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const fontSizes = {
    1: "1.5rem",
    2: "1.3rem",
    3: "1.15rem",
    4: "1rem",
    5: "0.95rem",
    6: "0.9rem",
  } as const;

  return (
    <Typography
      key={key}
      component={headingComponent}
      sx={{
        m: 0,
        fontWeight: 700,
        fontSize: fontSizes[normalizedLevel],
        lineHeight: 1.3,
        overflowWrap: "anywhere",
      }}
    >
      {renderInlineMarkdown(text, key)}
    </Typography>
  );
}

function renderCodeBlock(code: string, key: string) {
  return (
    <Box
      key={key}
      component="pre"
      sx={(theme) => ({
        m: 0,
        p: 1.5,
        borderRadius: 1,
        overflowX: "auto",
        bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.07 : 0.06),
        border: "1px solid",
        borderColor: alpha(theme.palette.divider, 0.8),
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.5,
      })}
    >
      <Box component="code">{code}</Box>
    </Box>
  );
}

function renderList(items: string[], ordered: boolean, key: string) {
  return (
    <Box
      key={key}
      component={ordered ? "ol" : "ul"}
      sx={{
        m: 0,
        pl: 3,
        "& li + li": {
          mt: 0.75,
        },
      }}
    >
      {items.map((item, index) => (
        <Box key={`${key}-item-${index}`} component="li" sx={{ pl: 0.25 }}>
          <Typography
            component="span"
            variant="body1"
            sx={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {renderInlineMarkdown(item, `${key}-item-${index}`)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function renderMarkdownBlocks(content: string, keyPrefix = "markdown"): ReactNode[] {
  const normalizedContent = content.replace(/\r\n/g, "\n");
  const lines = normalizedContent.split("\n");
  const blocks: ReactNode[] = [];
  let lineIndex = 0;
  let blockIndex = 0;

  while (lineIndex < lines.length) {
    const rawLine = lines[lineIndex];
    const trimmedLine = rawLine.trimStart();

    if (!trimmedLine) {
      lineIndex += 1;
      continue;
    }

    if (CODE_FENCE_PATTERN.test(trimmedLine)) {
      const codeLines: string[] = [];
      lineIndex += 1;

      while (lineIndex < lines.length && !lines[lineIndex].trimStart().startsWith("```")) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }

      if (lineIndex < lines.length) {
        lineIndex += 1;
      }

      blocks.push(renderCodeBlock(codeLines.join("\n"), `${keyPrefix}-block-${blockIndex}`));
      blockIndex += 1;
      continue;
    }

    const headingMatch = trimmedLine.match(HEADING_PATTERN);
    if (headingMatch) {
      blocks.push(
        renderHeading(headingMatch[1].length, headingMatch[2], `${keyPrefix}-block-${blockIndex}`),
      );
      lineIndex += 1;
      blockIndex += 1;
      continue;
    }

    if (isHorizontalRule(trimmedLine)) {
      blocks.push(
        <Box
          key={`${keyPrefix}-block-${blockIndex}`}
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        />,
      );
      lineIndex += 1;
      blockIndex += 1;
      continue;
    }

    if (BLOCKQUOTE_PATTERN.test(trimmedLine)) {
      const quoteLines: string[] = [];

      while (lineIndex < lines.length && BLOCKQUOTE_PATTERN.test(lines[lineIndex].trimStart())) {
        quoteLines.push(lines[lineIndex].trimStart().replace(BLOCKQUOTE_PATTERN, "$1"));
        lineIndex += 1;
      }

      blocks.push(
        <Box
          key={`${keyPrefix}-block-${blockIndex}`}
          sx={{
            pl: 1.5,
            borderLeft: "3px solid",
            borderColor: "divider",
            color: "text.secondary",
            "& .MuiTypography-root": {
              color: "inherit",
            },
          }}
        >
          <Stack spacing={1}>{renderMarkdownBlocks(quoteLines.join("\n"), `${keyPrefix}-quote-${blockIndex}`)}</Stack>
        </Box>,
      );
      blockIndex += 1;
      continue;
    }

    if (UNORDERED_LIST_PATTERN.test(trimmedLine)) {
      const items: string[] = [];

      while (lineIndex < lines.length) {
        const currentLine = lines[lineIndex].trimStart();
        const currentMatch = currentLine.match(UNORDERED_LIST_PATTERN);

        if (!currentMatch) {
          break;
        }

        items.push(currentMatch[1]);
        lineIndex += 1;
      }

      blocks.push(renderList(items, false, `${keyPrefix}-block-${blockIndex}`));
      blockIndex += 1;
      continue;
    }

    if (ORDERED_LIST_PATTERN.test(trimmedLine)) {
      const items: string[] = [];

      while (lineIndex < lines.length) {
        const currentLine = lines[lineIndex].trimStart();
        const currentMatch = currentLine.match(ORDERED_LIST_PATTERN);

        if (!currentMatch) {
          break;
        }

        items.push(currentMatch[1]);
        lineIndex += 1;
      }

      blocks.push(renderList(items, true, `${keyPrefix}-block-${blockIndex}`));
      blockIndex += 1;
      continue;
    }

    const paragraphLines = [rawLine.trimEnd()];
    lineIndex += 1;

    while (lineIndex < lines.length) {
      const nextLine = lines[lineIndex];
      if (!nextLine.trim() || isBlockStarter(nextLine)) {
        break;
      }

      paragraphLines.push(nextLine.trimEnd());
      lineIndex += 1;
    }

    blocks.push(
      renderParagraph(paragraphLines.join("\n"), `${keyPrefix}-block-${blockIndex}`),
    );
    blockIndex += 1;
  }

  return blocks;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return <Stack spacing={1.25}>{renderMarkdownBlocks(content)}</Stack>;
}
