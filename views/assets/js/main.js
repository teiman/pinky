
console.log("[main] Loading...");


var Main = {};

Main.entnum = 2000;
Main.ents = []; //entities coming from Quake
Main.nodes = []; //nodes in the page

Main.live_selected = null;

Main.table_template = null;

Main.classname_filter = "";


Main.boot = function(){
    console.log("[Main][boot] ...");

    var div = document.createElement("div");

    for(var t =0;t< Main.entnum;t++){
        var span = document.createElement("span");
        span.setAttribute("class","entity noclass");        
        span.setAttribute("id","entity_"+t)
        span.setAttribute("data-id",t);
        span.innerHTML = "";
        Main.nodes[t] = span;
        div.appendChild(span);        
    }

    $("#entitybox").append(div);
};


Main.update = function(){
    //console.log("[Main][update] ...");
    if(Main.live_selected !== null){
        Main.on_click_id(Main.live_selected);
    }
};


Main.setStatus = function(status){
    $("#current-status").text(status);
}


Main.resyncSpans = function(){
    var len = Main.ents.length;

    for(var t=0;t<len;t++){
        var classname = Main.ents[t].classname || "unused"; //entity class on que engine entity
        e = Main.nodes[t];

        var actual_class = e.getAttribute("title");//entity class on the website ui 
        var extra_class = "";

        //Class has changed
        if( classname != actual_class){
            extra_class = " justmodified";
        }
        
        e.setAttribute("class","entity entity-"+classname + extra_class);//replace classname 
        e.setAttribute("title",classname);
    }

    Main.updateClassnameFilterbox();
};


Main.loadAllEntities = function(){
    //console.log("[Main][loadAllEntities] ...");

    $.ajax({
        type: "POST",
        url: "/ents/all",
        data: {}, // we don't have data to pass at this time
        dataType: "json",
        success: function(data){
            Main.ents = data.ents;
            Main.setStatus(data.status); // this would change "not connected" to "connected"
            Main.resyncSpans();
        }
    });    
}

Main.loadDelta = function(){
    console.log("[Main][loadAllEntities] ...");

    $.ajax({
        type: "POST",
        url: "/ents/delta",
        data: {},
        dataType: "json",
        success: function(data){
            console.log(data);

            Main.ents = data.ents;
            Main.setStatus(data.status);
        }
    });    
}

Main.on_click_id = function(id){
    var entity = Main.ents[id];
    var $table = $("#stats-table");

    var html = Main.table_template({itemdata:entity});
    $table.html( html );    
};

Main.on_click_entity = function(node){
    var id = $(node).attr("data-id");
    Main.live_selected = id;//live update this one
    Main.on_click_id(id);
};

Main.updateClassnameFilterbox = function(){
    var e, className;
    var text = Main.classname_filter;
    var len = Main.ents.length;

    if(text == ""){
        for(var t=0;t<len;t++){
            Main.nodes[t].style.display = "";
        }
    }else{
        
        for(var t=0;t<len;t++){
            e = Main.nodes[t];
            className = e.getAttribute("class");            

            if(className.indexOf(text)>=0){
                Main.nodes[t].style.display = "";                
            }else{
                Main.nodes[t].style.display = "none";
            }            
        }
    }
};

Main.setClassnameFilterbox = function(text){
    var text = jQuery.trim(text);
    Main.classname_filter = text;
    Main.updateClassnameFilterbox();
};



$(function(){
    console.log("[main] Init...");

    Main.setStatus("booting...");
    Main.boot();

    Main.setStatus("loading ents...");
    Main.loadAllEntities();

    setInterval(function(){
        Main.loadAllEntities();

        Main.update();
    },500);

    $(document).on('click', function(evt) {
        if($(evt.target).hasClass('entity')) {
            Main.on_click_entity(evt.target);
        }
    });

    var code = $("#table-template").html();
    Main.table_template = Handlebars.compile(code);

    $("#filterbox").blur(function(){
        Main.setClassnameFilterbox( $("#filterbox").val() );
    });
});