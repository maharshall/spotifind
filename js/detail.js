function fillDetails(albums) {
    for(i in albums) {
        // get necessary info
        var title = albums[i].name;
        var artist = albums[i].artists[0].name;
        var year = albums[i].release_date.slice(0, 4);
        var tracks = albums[i].total_tracks;
        var art = albums[i].images[0].url;
        var id = albums[i].id;

        // populate html
        $(`#album${i}`).show();
        $(`#album${i} .value.title`).html(title);
        $(`#album${i} .value.artist`).html(artist);
        $(`#album${i} .value.year`).html(year);
        $(`#album${i} .value.tracks`).html(tracks);
        $(`#album${i} img`).attr('src', art);

        $(`#album${i}`).click(generateHandler(i));
    }
}

function generateHandler(i) {
    return function(event) {
        $('.grid-container').hide();
        $('h2').html($(`#album${i} .value.artist`).html()+' - '+$(`#album${i} .value.title`).html());
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === 'albums') {
        var albums = JSON.parse(request.data);
        fillDetails(albums);
    }

    return true;
});