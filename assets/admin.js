(function($){
  function addRow($table, tpl) {
    const $tbody = $table.find('tbody');
    const idx = $tbody.find('tr').length;
    const html = tpl.replace(/\{i\}/g, idx);
    $tbody.append(html);
  }

  $(document).on('click', '.link-delete-row', function(){
    $(this).closest('tr').remove();
  });

  $('#btn-add-playlist').on('click', function(){
    const tpl = `
      <tr>
        <td><input type="text" name="playlist[{i}][title]" class="regular-text"></td>
        <td><input type="text" name="playlist[{i}][artist]" class="regular-text"></td>
        <td><input type="url"  name="playlist[{i}][src]" class="regular-text" placeholder="https://.../song.mp3"></td>
        <td><input type="url"  name="playlist[{i}][cover]" class="regular-text" placeholder="https://.../cover.jpg"></td>
        <td><button type="button" class="button link-delete-row">X</button></td>
      </tr>`;
    addRow($('#gp-table-playlist'), tpl);
  });

  $('#btn-add-nature').on('click', function(){
    const tpl = `
      <tr>
        <td><input type="text" name="nature[{i}][id]" class="regular-text" placeholder="rain"></td>
        <td><input type="text" name="nature[{i}][name]" class="regular-text" placeholder="Mưa"></td>
        <td><input type="url"  name="nature[{i}][src]" class="regular-text" placeholder="https://.../rain.mp3"></td>
        <td><textarea name="nature[{i}][icon]" rows="3" class="large-text code" placeholder="<svg ...>...</svg>"></textarea></td>
        <td><button type="button" class="button link-delete-row">X</button></td>
      </tr>`;
    addRow($('#gp-table-nature'), tpl);
  });

  $('#btn-add-instrument').on('click', function(){
    const tpl = `
      <tr>
        <td><input type="text" name="instrument[{i}][id]" class="regular-text" placeholder="piano"></td>
        <td><input type="text" name="instrument[{i}][name]" class="regular-text" placeholder="Piano"></td>
        <td><input type="url"  name="instrument[{i}][src]" class="regular-text" placeholder="https://.../piano.mp3"></td>
        <td><textarea name="instrument[{i}][icon]" rows="3" class="large-text code" placeholder="<svg ...>...</svg>"></textarea></td>
        <td><button type="button" class="button link-delete-row">X</button></td>
      </tr>`;
    addRow($('#gp-table-instrument'), tpl);
  });
})(jQuery);
