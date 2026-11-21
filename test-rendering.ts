import { renderContent } from './server/utils/rendering/index'

const input = `
[b]Bold with **Markdown**[/b]

[quote]
Outer quote with [i]italic[/i].

[quote]
Nested quote with **Markdown bold**.
[/quote]
[/quote]

[list]
[*][b]Bold item[/b] with **Markdown**
[*]Second item with [url=https://example.com]a link[/url]
[/list]

<div class="example">
  Raw <strong>HTML</strong> with [u]BBCode underline[/u].
</div>

<script>alert('unsafe')</script>
`

console.log(renderContent(input))
