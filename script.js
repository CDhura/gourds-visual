

// 操作を元に戻す用. 
let history = []; // 操作履歴を格納する配列. 
// Undo 後の操作を再実行するための配列
let redoStack = [];

// 手数表示用要素
const moveCountDisplay = document.getElementById('move-count');
// ボタン要素
const undoBtn  = document.getElementById('undo-btn');
const redoBtn  = document.getElementById('redo-btn');

// 手数表示を更新する関数. 
function updateMoveCount() {
    moveCountDisplay.textContent = `現在の手数: ${history.length}`;
}

// タイルの並び（0は空マスとする. ）（自由に変更可能. ）
let tiles = [0,1,2,3,4,5,6,7,8,9,10,11,12];

// SVG とボタンを取得
const svg = document.getElementById('puzzle');
const shuffleBtn = document.getElementById('shuffle');

// フォーム要素を取得
const tilesInput    = document.getElementById('tiles-input');
const applyTilesBtn = document.getElementById('apply-tiles');

// 六角形タイルの「中心から頂点まで」の長さ（px）を設定. 
const SIZE = 50;

// （後で計算する）オフセットと SVG サイズ
let offsetX = 0, offsetY = 0;
const MARGIN = SIZE;  // 周囲に余裕を持たせる余白（大きさはマイナスでなければ何でもいい. ）

// ピース用の画像. 
const PIECE_IMG_HOR  = 'piece-horizontal.png';
const PIECE_SIZE = 143;

// 「軸座標系」でマス目を定義. 
// q が +1 なら東へ１マス、–1 なら西へ１マス動いた位置を表す. 
// r が +1 なら南東へ１マス、–1 なら北西へ１マス動いた位置を表す. 
let coords = [];
for(let i = 0; i < tiles.length; i++){
    if(i === 0){
        coords.push({ q: 0, r: 0 });
    }else{
        coords.push({ q: (i + 1) / 2, r: -1 });
        coords.push({ q: (i + 1) / 2, r: 0 });
        i++;
    }
}

// tileToIdxを作成. 
let tileToIdx = Array(coords.length);
for(let i = 0; i < coords.length; i++){
    tileToIdx[tiles[i]] = i;
}

// 軸座標→ピクセル変換
function axialToPixel(q, r) {
    const x0 = SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y0 = SIZE * (3 / 2 * r);
    return { x: x0 + offsetX, y: y0 + offsetY };  // SVG中心寄せ用にオフセット
}

// SVG の幅・高さとオフセットを自動計算
function computeLayout() {
    // 全マスの六角形頂点を集める（バウンディングボックスとオフセットを求めるため. ）
    const allVerts = [];
    const baseVerts = hexagonVertices();
    coords.forEach(({ q, r }) => { // 各六角形に対して. 
        const x0 = SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y0 = SIZE * (3 / 2 * r);
        baseVerts.forEach(p => { // 1つの六角形の各頂点に対して. 
            // x0, y0は各六角形の中心座標, pは六角形の中心から見た頂点座標. 
            allVerts.push({ x: p.x + x0, y: p.y + y0 });
        });
    });

    // バウンディングボックスを求める
    const xs = allVerts.map(p => p.x); // xsは, p.xを集めたものになる. 
    const ys = allVerts.map(p => p.y);
    const minX = Math.min(...xs); // xsの中の最小値が得られる. 
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width  = maxX - minX;
    const height = maxY - minY;

    // オフセットと SVG サイズを設定
    offsetX = -minX + MARGIN; // 左端をX = 0にそろえた後, MARGINでさらに余裕を持たせる. （盤面の左端のX座標がX = MARGINになる. ）
    offsetY = -minY + MARGIN;
    svg.setAttribute('width',  width  + MARGIN * 2);
    svg.setAttribute('height', height + MARGIN * 2);
    // 必要であれば viewBox も合わせて設定
    // あとで調べる. 
    svg.setAttribute('viewBox', `0 0 ${width + MARGIN * 2} ${height + MARGIN * 2}`);
}


// 正六角形の頂点を取得. （正六角形を作るためのもの）
// 出力は, 「正六角形の中心を原点としたときの, 各頂点の座標」. 
function hexagonVertices() {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const ang = Math.PI / 180 * (60 * i - 30);
        pts.push({ x: SIZE * Math.cos(ang), y: SIZE * Math.sin(ang) }); // 複数値を要素として格納する場合, x, y等のように名前を付けないといけない. 
    }
    return pts;
}

// 盤面と配置を描画
function render() {
    // まずSVGをクリア
    // svg.firstChild が存在する限りループを回し、子要素を一つずつ削除. 
    while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
    }

    // 描画用グループを作成
    const gTiles  = document.createElementNS(svg.namespaceURI, 'g'); // 六角形
    const gImages = document.createElementNS(svg.namespaceURI, 'g'); // ピース画像
    const gTexts  = document.createElementNS(svg.namespaceURI, 'g'); // 数字

    // 六角形タイルと数字をグループに追加
    tiles.forEach((num, idx) => {
        const { q, r } = coords[idx];
        const { x, y } = axialToPixel(q, r);
        const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

        // hexのpoints属性にセットするために, 六角形頂点配列を文字列化. 
        const points = hexagonVertices()
            .map(p => `${p.x + x},${p.y + y}`)
            .join(' ');
        hex.setAttribute('points', points); // 頂点情報を入れる. 

        hex.setAttribute('fill', '#ddd');
        hex.setAttribute('stroke', '#333'); // 枠線の色
        hex.setAttribute('stroke-width', '1.5'); // 枠線の幅
        hex.addEventListener('click', () => move(idx));
        gTiles.appendChild(hex);

        if (num === 0) {
            // 空マスならドットを描画
            const dot = document.createElementNS(svg.namespaceURI, 'circle');
            dot.setAttribute('cx', x);                           // 中心X
            dot.setAttribute('cy', y + 1);                           // 中心Y
            dot.setAttribute('r',  SIZE * 0.10);                 // 半径（タイルサイズの15%）
            dot.setAttribute('fill', '#333');                    // 色
            dot.setAttribute('pointer-events', 'none');          // クリックを透過
            gTiles.appendChild(dot);
        } else {
            // 通常マスなら番号テキストを描画
            const text = document.createElementNS(svg.namespaceURI, 'text');
            text.setAttribute('x',               x);
            text.setAttribute('y',               y + 1);
            text.setAttribute('text-anchor',     'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.textContent = num;
            gTexts.appendChild(text);
        }
    });

    // ピース画像を gImages に追加
    for(let i = 2; i < coords.length; i += 2){
        let pair = [i - 1, i];

        // ペアのタイル番号を分割代入
        const [a, b] = pair;

        // それぞれのタイルの現在のインデックスを取得
        const idxA = tileToIdx[a];
        const idxB = tileToIdx[b];

        // 軸座標からピクセル座標に変換
        const pA = axialToPixel(coords[idxA].q, coords[idxA].r);
        const pB = axialToPixel(coords[idxB].q, coords[idxB].r);

        // ピースの中点を計算
        const mx = (pA.x + pB.x) / 2;
        const my = (pA.y + pB.y) / 2 + 1; // 若干下に下げる. 

        // SVG の <image> 要素を作成
        const img = document.createElementNS(svg.namespaceURI, 'image');

        // 画像ソースを設定
        img.setAttribute('href', PIECE_IMG_HOR);

        // 画像をクリック無視に設定
        img.setAttribute('pointer-events', 'none');

        // 画像を中点に合わせて配置（PIECE_SIZE/2 だけ左上をずらす）
        // mx, myのままだと, 画像の左下端が中心になってしまう. 
        img.setAttribute('x',      mx - PIECE_SIZE / 2);
        img.setAttribute('y',      my - PIECE_SIZE / 2);
        
        // 画像サイズを設定
        img.setAttribute('width',  PIECE_SIZE);
        img.setAttribute('height', PIECE_SIZE);

        // ここから回転角度の設定
        let angle = 0;
        if(pA.y === pB.y){
            angle = 0;
        }else if((pA.x < pB.x && pA.y < pB.y) || (pA.x > pB.x && pA.y > pB.y)){
            angle = 60;
        }else{
            angle = -60;
        }

        // 中心(mx,my)を軸に回転
        img.setAttribute('transform', `rotate(${angle}, ${mx}, ${my})`);
        
        gImages.appendChild(img);
    }

    // グループを重ねる順に SVG に追加
    svg.appendChild(gTiles);
    svg.appendChild(gImages);
    svg.appendChild(gTexts);
}

// 隣接マスのインデックス一覧を返す（idxには基本, 空マスのインデックスが入る. ）
function neighbors(idx) {
    const { q, r } = coords[idx];
    const dirs = [
        [ +1,  0 ], [ +1, -1 ], [ 0, -1 ],
        [ -1,  0 ], [ -1, +1 ], [ 0, +1 ],
    ];
    return dirs
        .map(([dq, dr]) => {
            const nq = q + dq, nr = r + dr; // 隣接マスの軸座標を計算. 
            return coords.findIndex(c => c.q === nq && c.r === nr); // coordsの座標と隣接マスの座標が一致するような, coordsのインデックスを出力. 
        })
        .filter(i => i >= 0); // findIndex()の際に, 隣接マスのインデックスが見つからなかったら-1を返すので, それを除外するために.filter()を行う. 
}

// タイル移動処理
function move(idx) {
    const emptyIdx = tiles.indexOf(0); // 空マスを取得. 

    // 移動可能な場合の処理. 
    if (neighbors(emptyIdx).includes(idx)) { // 移動するタイルと空マスが隣接している場合. 
        let neighborIdxs = neighbors(idx);
        let jointIdx; // ペアのタイルのインデックス. 
        
        // 履歴 & 手数の処理. 
        redoStack = [];
        history.push(tiles.slice()); // 変更前のタイル配列をコピーして履歴に保存. 
        updateMoveCount();  // 手数表示を更新. 

        // jointIdxを見つける. 
        if(tiles[idx] % 2 == 0){ // タイル番号が偶数なら, 番号-1のタイル番号のインデックスを見つける. 
            jointIdx = tileToIdx[tiles[idx] - 1];
        }else{ // タイル番号が奇数なら, 番号+1のタイル番号のインデックスを見つける. 
            jointIdx = tileToIdx[tiles[idx] + 1];
        }

        // jointIdxが空のセルと接するか否かで, スライド・ターン or ピボットを決める. 
        if(neighbors(emptyIdx).includes(jointIdx)){ // 接する場合：ピボット
            [tileToIdx[tiles[emptyIdx]], tileToIdx[tiles[idx]]] = 
                [tileToIdx[tiles[idx]], tileToIdx[tiles[emptyIdx]]]; // tileToIdxを更新. 
            [tiles[emptyIdx], tiles[idx]] = [tiles[idx], tiles[emptyIdx]]; // tilesを更新. 
        }else{ // 接しない場合：スライド・ターン
            [tileToIdx[tiles[emptyIdx]], tileToIdx[tiles[idx]], tileToIdx[tiles[jointIdx]]] = 
                [tileToIdx[tiles[jointIdx]], tileToIdx[tiles[emptyIdx]], tileToIdx[tiles[idx]]]; // ここだけtilesの場合と異なる点に注意. 
            [tiles[emptyIdx], tiles[idx], tiles[jointIdx]] = [tiles[idx], tiles[jointIdx], tiles[emptyIdx]];
        }

        // 再度描画. 
        render();

        // クリア確認. 
        // if (isComplete()) {
        //     setTimeout(() => alert('クリア！'), 100);
        // }
        
    }
}

// 完成判定：タイルが順に並んでいるかチェック
// function isComplete() {
//     return tiles.slice(0, coords.length - 1).every((n, i) => n === i);
// }

// タイル配置を入力値から読み込んで反映する関数
function updateTilesFromInput() {
    // 入力欄の文字列を取得
    const inputValue = tilesInput.value;
    // カンマ区切りで分割し、数値に変換
    const newTiles = inputValue.split(',')
        .map(function(v) { return parseInt(v.trim(), 10); });
    // 長さと数値チェック
    if (newTiles.every(function(n) { return !isNaN(n); })) {
        // tiles を置き換え
        tiles = newTiles;
        coords = [];
        for(let i = 0; i < tiles.length; i++){
            if(i === 0){
                coords.push({ q: 0, r: 0 });
            }else{
                coords.push({ q: (i + 1) / 2, r: -1 });
                coords.push({ q: (i + 1) / 2, r: 0 });
                i++;
            }
        }
        // tileToIdx を再構築
        tileToIdx = Array(coords.length);
        for (let i = 0; i < coords.length; i++) {
            tileToIdx[tiles[i]] = i;
        }
        // レイアウト再計算・再描画
        computeLayout();
        render();

        // 手数を0にする. 
        history = [];
        updateMoveCount();

        // 初期配置をフォーム下に表示する
        const initialContainer = document.getElementById('initial-display');
        initialContainer.innerHTML = '';               // 既存内容をクリア
        const clone = svg.cloneNode(true);             // puzzle SVG のクローンを作成
        clone.removeAttribute('id');                   // id 重複を防ぐ
        initialContainer.appendChild(clone);           // クローンを表示領域に追加

        // 「初期配置」と表示. 
        const label = document.createElement('p');     // <p> 要素を新規作成
        label.textContent = '初期配置';                 // テキストとして「初期配置」を設定
        initialContainer.appendChild(label);           // クローン下にラベルを追加
    }
}

// フォーム要素を取得
const tilesForm    = document.getElementById('tiles-form');
// 「submit」イベントを登録
tilesForm.addEventListener('submit', function(e) {
    // デフォルトのリロードを防止
    e.preventDefault();
    // 更新関数を呼び出し
    updateTilesFromInput();
});

// Undoボタンがクリックされたときの処理. 
undoBtn.addEventListener('click', function() {
    // 履歴が空なら何もしない
    if (history.length === 0) return;

    // 現在の状態を redoStack に保存
    redoStack.push(tiles.slice());

    // 最後の状態を取り出し、tiles を復元
    tiles = history.pop();

    // tileToIdx を再構築
    tileToIdx = Array(coords.length);
    for (let i = 0; i < coords.length; i++) {
        tileToIdx[tiles[i]] = i;
    }

    // 盤面を再描画
    render();
    // 手数を更新. 
    updateMoveCount();
});

// 進める（Redo）ボタンの処理
redoBtn.addEventListener('click', function() {
    // redoStack が空なら何もしない
    if (redoStack.length === 0) return;
    // 現在の状態を履歴に保存
    history.push(tiles.slice());
    updateMoveCount();
    // 一手進める
    tiles = redoStack.pop();
    // tileToIdx を再構築
    tileToIdx = Array(coords.length);
    for (let i = 0; i < coords.length; i++) {
        tileToIdx[tiles[i]] = i;
    }
    render();
});

// updateMoveCount();  // Undo ごとに表示を更新

// 初期化
computeLayout();
updateTilesFromInput();
updateMoveCount();
